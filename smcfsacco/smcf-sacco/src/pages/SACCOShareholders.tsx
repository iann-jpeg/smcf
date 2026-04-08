import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Briefcase, 
  DollarSign, 
  TrendingUp, 
  FileText, 
  Download,
  BarChart3,
  Clock,
  Search,
  Plus
} from 'lucide-react';

// Tab Components (will be created in separate files)
import { OverviewTab } from '@/pages/tabs/OverviewTab';
import { ShareholdersTab } from '@/pages/tabs/ShareholdersTab';
import { SharesLedgerTab } from '@/pages/tabs/SharesLedgerTab';
import { DividendsTab } from '@/pages/tabs/DividendsTab';
import { ReserveFundTab } from '@/pages/tabs/ReserveFundTab';
import { PoliciesDocumentsTab } from '@/pages/tabs/PoliciesDocumentsTab';
import { DownloadsTab } from '@/pages/tabs/DownloadsTab';
import { ReportsTab } from '@/pages/tabs/ReportsTab';
import { AuditLogsTab } from '@/pages/tabs/AuditLogsTab';

export default function SACCOShareholdersModule() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Sample statistics (will be replaced with real data)
  const stats = {
    totalShareholders: 247,
    activeShareholders: 234,
    totalSharesIssued: 45680,
    shareCapitalValue: 45680000, // 45,680 * 1,000
    reserveFundBalance: 2850000,
    totalDividendsDeclared: 8950000,
    pendingApplications: 8,
    exitingMembers: 3
  };

  // Handle tab navigation with smooth scroll
  useEffect(() => {
    if (tabsContainerRef.current) {
      // Scroll the tabs container into view with smooth behavior
      const headerOffset = 80; // Account for any fixed headers
      const elementPosition = tabsContainerRef.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }, [activeTab]);

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Briefcase className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-gray-900">SACCO Shareholders</h1>
        </div>
        <p className="text-gray-600">
          Manage <span className="font-semibold text-[#C9A227]">SMC</span><span className="font-semibold text-[#2D7A36]">F</span> shareholder structure, shares, dividends, and governance documents
        </p>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Shareholders</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalShareholders}</p>
                <p className="text-xs text-green-600 mt-1">↑ 12 new this month</p>
              </div>
              <Users className="h-10 w-10 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Shares Issued</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalSharesIssued.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">@ KES 1,000 per share</p>
              </div>
              <Briefcase className="h-10 w-10 text-[#C9A227] opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Share Capital Value</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">KES {(stats.shareCapitalValue / 1000000).toFixed(1)}M</p>
                <p className="text-xs text-gray-500 mt-1">Total capital invested</p>
              </div>
              <DollarSign className="h-10 w-10 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Pending Actions</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{stats.pendingApplications + stats.exitingMembers}</p>
                <p className="text-xs text-orange-600 mt-1">Require admin review</p>
              </div>
              <Clock className="h-10 w-10 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Dividends Declared</p>
                <p className="text-2xl font-bold text-gray-900">KES {(stats.totalDividendsDeclared / 1000000).toFixed(1)}M</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Reserve Fund</p>
                <p className="text-2xl font-bold text-gray-900">KES {(stats.reserveFundBalance / 1000000).toFixed(1)}M</p>
              </div>
              <Briefcase className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Members</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeShareholders}</p>
                <Badge className="mt-2 bg-green-100 text-green-800" variant="secondary">
                  {((stats.activeShareholders / stats.totalShareholders) * 100).toFixed(0)}% active
                </Badge>
              </div>
              <Users className="h-8 w-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[250px]">
              <label className="text-sm font-medium text-gray-700 block mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search members, documents, transactions..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">From Date</label>
              <Input
                type="date"
                value={dateFilter.from}
                onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">To Date</label>
              <Input
                type="date"
                value={dateFilter.to}
                onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div ref={tabsContainerRef}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-9 h-auto p-2 bg-gray-100 rounded-lg">
          <TabsTrigger value="overview" className="text-xs sm:text-sm py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
            <div className="flex flex-col items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
              <span className="sm:hidden">Overview</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="shareholders" className="text-xs sm:text-sm py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
            <div className="flex flex-col items-center gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Shareholders</span>
              <span className="sm:hidden">Holders</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="shares_ledger" className="text-xs sm:text-sm py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
            <div className="flex flex-col items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>Shares</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="dividends" className="text-xs sm:text-sm py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
            <div className="flex flex-col items-center gap-1">
              <DollarSign className="h-4 w-4" />
              <span>Dividends</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="reserves" className="text-xs sm:text-sm py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
            <div className="flex flex-col items-center gap-1">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Reserves</span>
              <span className="sm:hidden">Reserve</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="policies" className="text-xs sm:text-sm py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
            <div className="flex flex-col items-center gap-1">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Policies</span>
              <span className="sm:hidden">Policy</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="downloads" className="text-xs sm:text-sm py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
            <div className="flex flex-col items-center gap-1">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Downloads</span>
              <span className="sm:hidden">Download</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
            <div className="flex flex-col items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Reports</span>
              <span className="sm:hidden">Report</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs sm:text-sm py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
            <div className="flex flex-col items-center gap-1">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Audit</span>
              <span className="sm:hidden">Audit</span>
            </div>
          </TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        <TabsContent value="overview" className="space-y-4">
          <OverviewTab stats={stats} />
        </TabsContent>

        <TabsContent value="shareholders" className="space-y-4">
          <ShareholdersTab searchQuery={searchQuery} />
        </TabsContent>

        <TabsContent value="shares_ledger" className="space-y-4">
          <SharesLedgerTab dateFilter={dateFilter} searchQuery={searchQuery} />
        </TabsContent>

        <TabsContent value="dividends" className="space-y-4">
          <DividendsTab />
        </TabsContent>

        <TabsContent value="reserves" className="space-y-4">
          <ReserveFundTab />
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <PoliciesDocumentsTab />
        </TabsContent>

        <TabsContent value="downloads" className="space-y-4">
          <DownloadsTab searchQuery={searchQuery} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <ReportsTab />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditLogsTab />
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
