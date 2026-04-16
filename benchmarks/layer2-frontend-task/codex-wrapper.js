const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Codex CLI Wrapper
 * 프로그래밍 방식으로 Codex 호출
 */
class CodexWrapper {
  constructor(options = {}) {
    this.model = options.model || 'gpt-4o';
    this.temperature = options.temperature || 0.1;
    this.maxTokens = options.maxTokens || 8192;
  }

  /**
   * Codex 실행
   * @param {string} context - 컨텍스트 (vanilla: 전체 파일, fooks: 추출된 payload)
   * @param {string} taskPrompt - 작업 지시문
   * @returns {Promise<Object>} 실행 결과
   */
  async run(context, taskPrompt) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    // 프롬프트 구성
    const fullPrompt = this.buildPrompt(context, taskPrompt);
    
    // 임시 파일에 프롬프트 저장
    const tempPromptFile = `/tmp/codex-prompt-${Date.now()}.txt`;
    fs.writeFileSync(tempPromptFile, fullPrompt);
    
    return new Promise((resolve, reject) => {
      // Codex CLI exec 호출
      const args = [
        'exec',
        '-m', this.model,
        '--full-auto'
      ];
      
      // 프롬프트를 stdin으로 전달
      const promptContent = fs.readFileSync(tempPromptFile, 'utf-8');
      
      console.log(`[CodexWrapper] Executing: codex exec -m ${this.model}`);
      
      const codex = spawn('codex', args, {
        env: { ...process.env, OPENAI_API_KEY: process.env.OPENAI_API_KEY },
        timeout: 300000 // 5분 타임아웃
      });
      
      // stdin으로 프롬프트 전달
      codex.stdin.write(promptContent);
      codex.stdin.end();
      
      let stdout = '';
      let stderr = '';
      
      codex.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data); // 실시간 출력
      });
      
      codex.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data); // 실시간 에러 출력
      });
      
      codex.on('close', (exitCode) => {
        const endTime = Date.now();
        const latencyMs = endTime - startTime;
        
        // 임시 파일 삭제
        try {
          fs.unlinkSync(tempPromptFile);
        } catch (e) {
          // 무시
        }
        
        const result = {
          exitCode,
          success: exitCode === 0,
          stdout,
          stderr,
          latencyMs,
          timestamp,
          metadata: {
            model: this.model,
            temperature: this.temperature,
            maxTokens: this.maxTokens,
            promptLength: fullPrompt.length,
            promptTokens: Math.ceil(fullPrompt.length / 3.5) // 대략적인 토큰 수
          }
        };
        
        if (exitCode === 0) {
          resolve(result);
        } else {
          resolve(result); // 실패해도 결과 반환 (retry 위해)
        }
      });
      
      codex.on('error', (error) => {
        reject({
          exitCode: -1,
          success: false,
          error: error.message,
          latencyMs: Date.now() - startTime,
          timestamp
        });
      });
    });
  }
  
  buildPrompt(context, taskPrompt) {
    return `# Task: ${taskPrompt}

## Context (File Content or Extracted Structure):
${context}

## Instructions:
1. Refactor the code into modular components as specified
2. Maintain all existing functionality
3. Ensure no circular dependencies
4. Keep each file under 200 lines
5. Add proper barrel exports

## Output:
Provide the complete refactored code for each new file.`;
  }
}

module.exports = CodexWrapper;
