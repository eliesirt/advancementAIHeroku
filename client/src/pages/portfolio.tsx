import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ProspectWithDetails } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Search, Filter, Users, DollarSign, Calendar, Award, ArrowUpDown } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
import { useToast } from "@/hooks/use-toast";

type SortField = 'fullName' | 'prospectRating' | 'lifetimeGiving' | 'lastContactDate' | 'stage';
type SortDirection = 'asc' | 'desc';

export default function PortfolioPage() {
  const [selectedProspect, setSelectedProspect] = useState<ProspectWithDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>('fullName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiNextActionsLoading, setAiNextActionsLoading] = useState(false);
  const [refreshingProspects, setRefreshingProspects] = useState<Set<number>>(new Set());
  const [refreshingAll, setRefreshingAll] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch prospects
  const { data: prospects = [], isLoading, error } = useQuery<ProspectWithDetails[]>({
    queryKey: ['/api/prospects'],
    retry: false,
  });

  // Refresh individual prospect with loading state
  const refreshProspect = async (prospectId: number) => {
    try {
      setRefreshingProspects(prev => new Set(prev).add(prospectId));
      
      // Use the new portfolio refresh endpoint
      const response = await apiRequest(`/api/portfolio/refresh/${prospectId}`, 'POST');
      
      toast({
        title: "Refresh Started",
        description: `Data refresh initiated for prospect. This may take a few moments.`,
      });
      
      console.log(`🔄 Portfolio refresh response for ${prospectId}:`, response);
    } catch (error) {
      console.error(`❌ Portfolio refresh failed for ${prospectId}:`, error);
      toast({
        title: "Error",
        description: "Failed to start refresh process", 
        variant: "destructive",
      });
    } finally {
      // Remove loading state after a delay to show user that process started
      setTimeout(() => {
        setRefreshingProspects(prev => {
          const newSet = new Set(prev);
          newSet.delete(prospectId);
          return newSet;
        });
      }, 2000);
    }
  };

  // Refresh all prospects with sequential processing
  const refreshAllProspects = async () => {
    try {
      setRefreshingAll(true);
      
      const prospectIds = prospects.map(p => p.id);
      console.log(`🔄 Starting sequential refresh for ${prospectIds.length} prospects`);
      
      // Process prospects one by one to prevent server overload
      for (const prospectId of prospectIds) {
        try {
          setRefreshingProspects(prev => new Set(prev).add(prospectId));
          
          console.log(`🔄 Processing prospect ${prospectId}...`);
          await apiRequest('POST', `/api/portfolio/refresh/${prospectId}`);
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`❌ Failed to refresh prospect ${prospectId}:`, error);
        } finally {
          setRefreshingProspects(prev => {
            const newSet = new Set(prev);
            newSet.delete(prospectId);
            return newSet;
          });
        }
      }
      
      toast({
        title: "Bulk Refresh Complete",
        description: `Refresh process initiated for all ${prospectIds.length} prospects.`,
      });
      
    } catch (error) {
      console.error('❌ Bulk refresh error:', error);
      toast({
        title: "Error", 
        description: "Failed to start bulk refresh process",
        variant: "destructive",
      });
    } finally {
      setRefreshingAll(false);
    }
  };

  // Filtered and sorted prospects
  const filteredProspects = useMemo(() => {
    let filtered = prospects.filter(prospect => {
      const matchesSearch = prospect.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           prospect.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           prospect.employer?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStage = stageFilter === "all" || prospect.stage === stageFilter;
      const matchesRating = ratingFilter === "all" || prospect.prospectRating === ratingFilter;
      
      return matchesSearch && matchesStage && matchesRating;
    });

    // Sort prospects
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle dates
      if (sortField === 'lastContactDate') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }
      
      // Handle numbers
      if (sortField === 'lifetimeGiving') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      }

      // Handle strings
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [prospects, searchTerm, stageFilter, ratingFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  const getProspectRatingColor = (rating: string) => {
    switch (rating) {
      case 'Leadership': return 'bg-purple-100 text-purple-800';
      case 'Principal': return 'bg-blue-100 text-blue-800';
      case 'Major': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Identification': return 'bg-yellow-100 text-yellow-800';
      case 'Cultivation': return 'bg-orange-100 text-orange-800';
      case 'Solicitation': return 'bg-red-100 text-red-800';
      case 'Stewardship': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppNavigation appName="portfolioAI" />
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-600" />
          <span className="ml-2 text-gray-600">Loading prospects...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppNavigation appName="portfolioAI" />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <p className="text-red-800">Error loading prospects. Please try again.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation appName="portfolioAI" />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-8 text-white">
              <div className="flex items-center space-x-4">
                <div className="p-3 rounded-lg bg-white/20">
                  <Users className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">portfolioAI</h1>
                  <p className="text-red-100 text-lg mt-1">
                    AI-powered prospect portfolio management for fundraisers
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    <div>
                      <p className="font-semibold text-lg">{prospects.length}</p>
                      <p className="text-sm text-red-100">Total Prospects</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    <div>
                      <p className="font-semibold text-lg">
                        {formatCurrency(prospects.reduce((sum, p) => sum + (p.lifetimeGiving || 0), 0))}
                      </p>
                      <p className="text-sm text-red-100">Portfolio Value</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 mr-2" />
                    <div>
                      <p className="font-semibold text-lg">
                        {prospects.filter(p => p.lastContactDate && new Date(p.lastContactDate) > new Date(Date.now() - 30*24*60*60*1000)).length}
                      </p>
                      <p className="text-sm text-red-100">Contacted This Month</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="flex items-center">
                    <Award className="h-5 w-5 mr-2" />
                    <div>
                      <p className="font-semibold text-lg">
                        {prospects.filter(p => p.prospectRating === 'Leadership' || p.prospectRating === 'Principal').length}
                      </p>
                      <p className="text-sm text-red-100">Top Prospects</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Prospect List */}
          <div className="lg:col-span-2">
            <Card className="border-2 hover:border-red-100 transition-colors bg-white shadow-lg">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-3 text-xl font-bold text-gray-900">
                    <div className="p-2 rounded-lg bg-red-50">
                      <Users className="h-6 w-6" style={{ color: '#CC0000' }} />
                    </div>
                    <span>Prospect Portfolio</span>
                  </CardTitle>
                  <Button 
                    onClick={() => refreshAllProspects()}
                    disabled={refreshingAll}
                    className="bg-red-600 hover:bg-red-700"
                    data-testid="button-refresh-all"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshingAll ? 'animate-spin' : ''}`} />
                    {refreshingAll ? 'Refreshing...' : 'Refresh All'}
                  </Button>
                </div>
                
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search prospects..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Stages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      <SelectItem value="Identification">Identification</SelectItem>
                      <SelectItem value="Cultivation">Cultivation</SelectItem>
                      <SelectItem value="Solicitation">Solicitation</SelectItem>
                      <SelectItem value="Stewardship">Stewardship</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={ratingFilter} onValueChange={setRatingFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Ratings" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Ratings</SelectItem>
                      <SelectItem value="Leadership">Leadership</SelectItem>
                      <SelectItem value="Principal">Principal</SelectItem>
                      <SelectItem value="Major">Major</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    More Filters
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Prospects Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => handleSort('fullName')}
                        >
                          <div className="flex items-center">
                            Name
                            <ArrowUpDown className="ml-1 h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => handleSort('prospectRating')}
                        >
                          <div className="flex items-center">
                            Rating
                            <ArrowUpDown className="ml-1 h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => handleSort('lifetimeGiving')}
                        >
                          <div className="flex items-center">
                            Lifetime Giving
                            <ArrowUpDown className="ml-1 h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => handleSort('lastContactDate')}
                        >
                          <div className="flex items-center">
                            Last Contact
                            <ArrowUpDown className="ml-1 h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => handleSort('stage')}
                        >
                          <div className="flex items-center">
                            Stage
                            <ArrowUpDown className="ml-1 h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProspects.map((prospect) => (
                        <TableRow 
                          key={prospect.id}
                          className={`cursor-pointer hover:bg-red-50 ${selectedProspect?.id === prospect.id ? 'bg-red-100' : ''}`}
                          onClick={() => setSelectedProspect(prospect)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium text-gray-900">{prospect.fullName}</p>
                              <p className="text-sm text-gray-500">{prospect.occupation} at {prospect.employer}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getProspectRatingColor(prospect.prospectRating || 'Unknown')}>
                              {prospect.prospectRating}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(prospect.lifetimeGiving || 0)}</TableCell>
                          <TableCell>{formatDate(prospect.lastContactDate)}</TableCell>
                          <TableCell>
                            <Badge className={getStageColor(prospect.stage)}>
                              {prospect.stage}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                refreshProspect(prospect.id);
                              }}
                              disabled={refreshingProspects.has(prospect.id) || refreshingAll}
                              data-testid={`button-refresh-${prospect.id}`}
                            >
                              <RefreshCw className={`h-3 w-3 ${refreshingProspects.has(prospect.id) || refreshingAll ? 'animate-spin' : ''}`} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Prospect Details */}
          <div className="space-y-6">
            {selectedProspect ? (
              <>
                {/* Prospect Summary */}
                <Card className="border-2 hover:border-red-100 transition-colors bg-white shadow-lg">
                  <CardHeader className="border-b border-gray-100">
                    <CardTitle className="flex items-center space-x-3 text-lg font-bold text-gray-900">
                      <div className="p-2 rounded-lg bg-red-50">
                        <Users className="h-5 w-5" style={{ color: '#CC0000' }} />
                      </div>
                      <span>Prospect Summary</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="border-b pb-4">
                        <h3 className="font-semibold text-lg">{selectedProspect.fullName}</h3>
                        <p className="text-gray-600">{selectedProspect.occupation}</p>
                        <p className="text-gray-600">{selectedProspect.employer}</p>
                        {selectedProspect.spouse && (
                          <p className="text-sm text-gray-500">Spouse: {selectedProspect.spouse}</p>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Rating</p>
                          <Badge className={getProspectRatingColor(selectedProspect.prospectRating || 'Unknown')}>
                            {selectedProspect.prospectRating}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-gray-500">Stage</p>
                          <Badge className={getStageColor(selectedProspect.stage)}>
                            {selectedProspect.stage}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-gray-500">Lifetime Giving</p>
                          <p className="font-semibold">{formatCurrency(selectedProspect.lifetimeGiving || 0)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Last Contact</p>
                          <p className="font-semibold">{formatDate(selectedProspect.lastContactDate)}</p>
                        </div>
                      </div>

                      {selectedProspect.badges && selectedProspect.badges.length > 0 && (
                        <div>
                          <p className="text-gray-500 text-sm mb-2">Achievements</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedProspect.badges.map((badge) => (
                              <span 
                                key={badge.id}
                                className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800"
                              >
                                <span className="mr-1">{badge.badgeIcon}</span>
                                {badge.badgeName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedProspect.aiSummary ? (
                        <div>
                          <p className="text-gray-500 text-sm mb-2">AI Summary</p>
                          <p className="text-sm leading-relaxed">{selectedProspect.aiSummary}</p>
                        </div>
                      ) : (
                        <Button 
                          className="w-full mt-4 bg-red-600 hover:bg-red-700"
                          disabled={aiSummaryLoading}
                        >
                          {aiSummaryLoading ? (
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Generate AI Summary
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* AI Next Actions */}
                <Card className="border-2 hover:border-red-100 transition-colors bg-white shadow-lg">
                  <CardHeader className="border-b border-gray-100">
                    <CardTitle className="flex items-center space-x-3 text-lg font-bold text-gray-900">
                      <div className="p-2 rounded-lg bg-red-50">
                        <Award className="h-5 w-5" style={{ color: '#CC0000' }} />
                      </div>
                      <span>AI Next Actions</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {selectedProspect.aiNextActions ? (
                      <div className="prose prose-sm">
                        <div className="whitespace-pre-line text-sm leading-relaxed">
                          {selectedProspect.aiNextActions}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-gray-500 text-sm mb-4">No AI-generated next actions available</p>
                        <Button 
                          className="bg-red-600 hover:bg-red-700"
                          disabled={aiNextActionsLoading}
                        >
                          {aiNextActionsLoading ? (
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Generate Next Actions
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-2 border-gray-200 bg-white shadow-lg">
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Prospect</h3>
                  <p className="text-gray-500">Choose a prospect from the list to view their detailed information and AI-generated insights.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}