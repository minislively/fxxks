# 리스크 대응책 및 모니터링 포인트

## 개요

shadcn-ui 테스트를 통해 식별된 fooks 사용 시 주요 리스크와 대응책, 모니터링 가이드를 제공합니다.

---

## 식별된 리스크

### 1. Cold Scan 지연 (대용량 프로젝트)
| 항목 | 설명 |
|------|------|
| **증상** | 첫 컴포넌트 스캔 시 5초 이상 지연 |
| **원인** | AST 파싱, 의존성 그래프 구축, 캐시 미스 |
| **영향** | 사용자 첫 경험 저하, 생산성 감소 |
| **테스트 기준** | shadcn-ui 1000+ 컴포넌트 기준 |

### 2. 대용량 파일 누적 지연
| 항목 | 설명 |
|------|------|
| **임계값** | 50KB+ 파일 |
| **증상** | 다수의 대용량 파일 시 누적된 지연 |
| **원인** | 복잡한 컴포넌트/타입 정의 파싱 |

### 3. 첫 사용자 경험 저하
|| 항목 | 설명 |
||------|------|
|| **문제** | cold vs warm scan 성능 차이가 큼 (5초 vs 0.3초) |
|| **영향** | 사용자가 첫 실행 시 "멈춤"으로 인식 |

### 4. Small File "Negative Reduction" (Raw Mode)
|| 항목 | 설명 |
||------|------|
|| **증상** | 500B 미만 파일의 extract 결과가 원본보다 큼 (예: SimpleButton 356B → 1341B, -277% 압축률) |
|| **원인** | Raw mode에서는 500B 미만 파일은 원본 그대로 사용 |
|| **설명** | **이는 정상 동작입니다.** extract 결과는 메타데이터(JSON wrapping 등)가 추가되어 원본보다 커질 수 있음. 실제 전송/저장 시에는 원본 356B가 그대로 사용됨 |
|| **주의** | 압축률 계산 시 음수 값이 표시될 수 있으나, 이는 extract 메타데이터의 크기이며 실제 파일 처리에는 영향 없음 |

---

## 대응책

### 1. 로딩 인디케이터 (선택적)
```typescript
// 스캔 진행 상황 표시
const scanProgress = {
  showIndicator: true,      // CLI에서 진행률 표시
  showFileCount: true,      // 처리 중인 파일 수 표시
  thresholdMs: 1000,        // 1초 이상 걸릴 때만 표시
};
```

### 2. 문서화로 기대 관리
- **명확한 가이드**: 첫 스캔은 느릴 수 있음을 사전 안내
- **성능 비교 표 제공**:

| Scan Type | 예상 시간 | 조건 |
|-----------|-----------|------|
| Cold Scan | 3-8초 | 캐시 없음, 1000+ 컴포넌트 |
| Warm Scan | 0.2-0.5초 | 캐시 히트 |

### 3. Warm Scan 권장
```bash
# 개발 워크플로우 권장사항

# 1. 초기 캐시 구축 (1회)
fooks scan --init-cache

# 2. 이후 빠른 스캔
fooks scan  # 캐시 활용

# 3. CI/CD 환경
fooks scan --warm-only  # 캐시 미스 시 graceful fallback
```

---

## 모니터링 포인트

### 자동 리포팅 조건

| 지표 | 임계값 | 리포팅 조치 |
|------|--------|-------------|
| **Extract Time** | > 100ms | 느린 파일 목록 로깅 |
| **Cache Hit Rate** | < 90% | 캐시 최적화 필요 알림 |
| **Scan Time** | > 5초 | 성능 병목 분석 트리거 |

### 모니터링 구현 예시
```typescript
// 성능 모니터링 설정
const monitoring = {
  extractTimeThreshold: 100,     // ms
  cacheHitRateThreshold: 0.9,      // 90%
  scanTimeThreshold: 5000,         // ms

  onSlowExtract: (file: string, time: number) => {
    console.warn(`[PERF] Slow extraction: ${file} (${time}ms)`);
  },

  onLowCacheHit: (rate: number) => {
    console.warn(`[PERF] Low cache hit rate: ${(rate * 100).toFixed(1)}%`);
  },

  onSlowScan: (time: number, fileCount: number) => {
    console.error(`[PERF] Slow scan detected: ${time}ms for ${fileCount} files`);
  },
};
```

### 로그 출력 예시
```
[INFO] Scan started: 1247 components
[PERF] Slow extraction: src/ui/complex-form.tsx (245ms)
[PERF] Slow extraction: src/lib/validation.ts (189ms)
[INFO] Cache hit rate: 94.2%
[INFO] Scan completed: 5.2s (cold scan)
```

---

## 체크리스트

- [ ] 로딩 인디케이터 구현 또는 활성화
- [ ] 첫 사용자 가이드 문서 배포
- [ ] 모니터링 로깅 설정 완료
- [ ] 캐시 워밍업 스크립트 준비
- [ ] CI 환경 캐시 전략 수립

---

## 참고

- 관련 테스트: `tests/shadcn-ui-large.test.ts`
- 성능 벤치마크: `docs/PERFORMANCE_BENCHMARK.md`
- 구조 변경 채택 기준: [`docs/performance-vs-operational-complexity.md`](docs/performance-vs-operational-complexity.md)
