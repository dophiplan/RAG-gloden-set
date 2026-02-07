import Card from '@/components/ui/Card';

interface DashboardStatsPanelProps {
  stats: {
    total: number;
    pending: number;
    reviewed: number;
    deployed: number;
  };
}

export default function DashboardStatsPanel({ stats }: DashboardStatsPanelProps) {
  return (
    <>
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Reviewed</p>
              <p className="text-2xl font-bold text-green-600">{stats.reviewed}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Deployed</p>
              <p className="text-2xl font-bold text-gray-600">{stats.deployed}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      {/* Progress Bar */}
      {stats.total > 0 && (
        <Card>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">번역 진행률</span>
              <span className="text-gray-600">
                {Math.round(((stats.reviewed + stats.deployed) / stats.total) * 100)}% 완료
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
              <div
                className="bg-gray-400 transition-all duration-300"
                style={{ width: `${(stats.deployed / stats.total) * 100}%` }}
                title={`반영 완료: ${stats.deployed}`}
              />
              <div
                className="bg-green-500 transition-all duration-300"
                style={{ width: `${(stats.reviewed / stats.total) * 100}%` }}
                title={`검수 완료: ${stats.reviewed}`}
              />
              <div
                className="bg-yellow-400 transition-all duration-300"
                style={{ width: `${(stats.pending / stats.total) * 100}%` }}
                title={`번역 요청: ${stats.pending}`}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-yellow-400 rounded" />
                번역 요청 ({stats.pending})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-green-500 rounded" />
                검수 완료 ({stats.reviewed})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-gray-400 rounded" />
                반영 완료 ({stats.deployed})
              </span>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
