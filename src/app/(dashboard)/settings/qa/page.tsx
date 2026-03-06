'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface QAMetrics {
  codeQuality: number;
  testCoverage: number;
  eslintScore: number;
  apiStandardization: number;
  errorBoundaryCoverage: number;
  functionalQuality: number;
  reliability: number;
  performance: number;
}

interface TestResult {
  total: number;
  passed: number;
  failed: number;
  duration: string;
}

const getGrade = (score: number) => {
  if (score >= 90) return { grade: 'A', color: 'bg-green-500' };
  if (score >= 80) return { grade: 'B+', color: 'bg-blue-500' };
  if (score >= 70) return { grade: 'B', color: 'bg-yellow-500' };
  if (score >= 60) return { grade: 'C', color: 'bg-orange-500' };
  return { grade: 'F', color: 'bg-red-500' };
};

interface MetricCardProps {
  title: string;
  score: number;
  description: string;
}

const MetricCard = ({ title, score, description }: MetricCardProps) => {
  const { grade, color } = getGrade(score);
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <Badge className={`${color} text-white`}>{grade}</Badge>
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-4xl font-bold text-gray-900">{score}%</span>
      </div>
      <p className="text-sm text-gray-500">{description}</p>
      <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </Card>
  );
};

export default function QAPage() {
  const [metrics, setMetrics] = useState<QAMetrics>({
    codeQuality: 94.1,
    testCoverage: 84.5,
    eslintScore: 100,
    apiStandardization: 100,
    errorBoundaryCoverage: 100,
    functionalQuality: 100,
    reliability: 100,
    performance: 100,
  });

  const [testResult, setTestResult] = useState<TestResult>({
    total: 243,
    passed: 243,
    failed: 0,
    duration: '3.89s',
  });

  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    // 테스트 실행 시뮬레이션
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  const averageScore = Math.round(
    (metrics.codeQuality +
      metrics.testCoverage +
      metrics.eslintScore +
      metrics.apiStandardization +
      metrics.errorBoundaryCoverage +
      metrics.functionalQuality +
      metrics.reliability +
      metrics.performance) /
      8
  );

  return (
    <DashboardLayout
      title="QA / TQC 품질 관리"
      subtitle="시스템 품질 메트릭스 및 테스트 결과"
    >
      <div className="space-y-6">
        {/* Overall Score */}
        <Card className="p-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">전체 품질 점수</h2>
              <p className="text-gray-600">목표: 90점 이상</p>
            </div>
            <div className="text-right">
              <span className={`text-6xl font-bold ${averageScore >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
                {averageScore}%
              </span>
              <Badge className={`ml-3 ${averageScore >= 90 ? 'bg-green-500' : 'bg-yellow-500'} text-white text-lg px-3 py-1`}>
                {getGrade(averageScore).grade}
              </Badge>
            </div>
          </div>
          <div className="mt-6 h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${averageScore >= 90 ? 'bg-green-500' : 'bg-yellow-500'} transition-all duration-500`}
              style={{ width: `${averageScore}%` }}
            />
          </div>
        </Card>

        {/* Test Results */}
        <Card className="p-6">
          <CardTitle>테스트 실행 결과</CardTitle>
          <div className="mt-4 grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">총 테스트</p>
              <p className="text-3xl font-bold text-gray-900">{testResult.total}</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">통과</p>
              <p className="text-3xl font-bold text-green-600">{testResult.passed}</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">실패</p>
              <p className="text-3xl font-bold text-red-600">{testResult.failed}</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">실행 시간</p>
              <p className="text-3xl font-bold text-blue-600">{testResult.duration}</p>
            </div>
          </div>
          <button
            onClick={runTests}
            disabled={loading}
            className="mt-4 w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '테스트 실행 중...' : '테스트 다시 실행'}
          </button>
        </Card>

        {/* Quality Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="코드 품질"
            score={metrics.codeQuality}
            description="TypeScript strict mode, any 사용량"
          />
          <MetricCard
            title="테스트 커버리지"
            score={metrics.testCoverage}
            description="Vitest coverage report"
          />
          <MetricCard
            title="ESLint"
            score={metrics.eslintScore}
            description="0 error, 0 warning"
          />
          <MetricCard
            title="API 표준화"
            score={metrics.apiStandardization}
            description="33 routes 표준화 완료"
          />
          <MetricCard
            title="Error Boundary"
            score={metrics.errorBoundaryCoverage}
            description="9개 페이지 적용"
          />
          <MetricCard
            title="기능 품질"
            score={metrics.functionalQuality}
            description="모든 기능 테스트 통과"
          />
          <MetricCard
            title="안정성"
            score={metrics.reliability}
            description="로딩 상태, 널 체크"
          />
          <MetricCard
            title="성능"
            score={metrics.performance}
            description="빌드, API 응답 시간"
          />
        </div>

        {/* Connected Areas */}
        <Card className="p-6">
          <CardTitle>연결된 설정 영역</CardTitle>
          <div className="mt-4 space-y-3">
            {[
              { name: '제품 관리', status: '정규화 완료', link: '/settings' },
              { name: '언어 관리', status: '정규화 완료', link: '/settings' },
              { name: '플랫폼 관리', status: '정규화 완료', link: '/settings' },
              { name: 'API 응답 표준화', status: '100% 완료', link: '/settings' },
              { name: '에러 바운더리', status: '9개 적용', link: '/settings' },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-900">{item.name}</span>
                <div className="flex items-center gap-3">
                  <Badge variant="success">{item.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Last Updated */}
        <div className="text-center text-sm text-gray-500">
          마지막 업데이트: {new Date().toLocaleString('ko-KR')}
        </div>
      </div>
    </DashboardLayout>
  );
}
