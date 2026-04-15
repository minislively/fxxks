# fooks Benchmark History

## Weekly Dogfooding Log

### 2026-04-14 주차

실제 React/TSX 프로젝트에서 fooks의 성능과 토큰 절약율을 측정한 데이터입니다.

#### 테스트 환경
- 측정 도구: fooks CLI (dist/cli/index.js)
- 측정 방법: cold scan (캐시 삭제 후 1회), warm scan (캐시 활용 1회)
- 시간 측정: Linux `time` command (real/wall-clock time)

#### 프로젝트 1: arpc-mono
- **설명**: Next.js 16 monorepo (ARPC App - Agent Runtime Platform Client)
- **구조**: Turbo monorepo (arpc-core + frontend-app)
- **파일 수**: 44 TSX files
- **node_modules**: 존재함

| 지표 | 값 |
|------|-----|
| Cold Scan 시간 | 0.527s |
| Warm Scan 시간 | 0.071s |
| 원본 바이트 | 371,022 bytes |
| 추출물 바이트 | 28,144 bytes |
| **Token 절약율** | **92.41%** |
| 캐시 히트율 | 100% (warm scan시) |

#### 프로젝트 2: oh-my-kanban
- **설명**: React/Vite 대시보드 (Go 기반 Kanban 오케스트레이터의 React UI)
- **구조**: packages/dashboard (Vite + React + TypeScript)
- **파일 수**: 21 TSX files  
- **node_modules**: 존재함

| 지표 | 값 |
|------|-----|
| Cold Scan 시간 | 0.307s |
| Warm Scan 시간 | 0.043s |
| 원본 바이트 | 56,114 bytes |
| 추출물 바이트 | 9,729 bytes |
| **Token 절약율** | **82.66%** |
| 캐시 히트율 | 100% (warm scan시) |

#### 종합 분석

| 프로젝트 | TSX 파일 수 | Cold Scan | Warm Scan | Speedup | Token 절약 |
|----------|-------------|-----------|-----------|---------|------------|
| arpc-mono | 44 | 0.527s | 0.071s | **7.4x** | 92.41% |
| oh-my-kanban | 21 | 0.307s | 0.043s | **7.1x** | 82.66% |

**주요 발견:**
1. **캐시 가속비**: 평균 7.3x (cold 대비 warm scan)
2. **토큰 절약**: 평균 87.5% (원본 대비 추출물 크기)
3. **확장성**: 파일 수가 2배 차이나도 scan 시간은 선형적 증가
4. **캐시 효율**: warm scan시 100% cache hit, 40-70ms 수준의 응답

#### 이전 Dogfooding 데이터

> oh-my-claudecode (2026-04-13)
> - 파일 수: 83,155개 (CLI 도구, 대형 프로젝트)
> - Token 절약율: ~90%
>
> cyberthug-screenclone (2026-04-13)  
> - 파일 수: 14 TSX
> - Token 절약율: ~85%

---

## 측정 방법론

### Cold Scan
```bash
rm -rf .fooks/cache
time fooks scan
```

### Warm Scan  
```bash
time fooks scan  # 캐시가 존재하는 상태
```

### Token 절약율 계산
```
savings_ratio = (1 - extracted_bytes / original_bytes) * 100%
```

- `original_bytes`: 원본 TSX 파일들의 총 바이트 크기
- `extracted_bytes`: fooks scan 결과 JSON의 총 바이트 크기

---

*마지막 업데이트: 2026-04-14*
