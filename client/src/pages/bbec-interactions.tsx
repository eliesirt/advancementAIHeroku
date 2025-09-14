import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BbecInteraction } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Filter, Users, Calendar, MessageSquare, ArrowUpDown, ArrowUp, ArrowDown, Eye, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AppNavigation } from "@/components/app-navigation";

type SortField = 'name' | 'contactMethod' | 'date' | 'lastSynced';
type SortDirection = 'asc' | 'desc';

interface BBECInteractionsPageProps {
  constituentId?: string; // Optional - if provided, show only interactions for this constituent
}

export default function BBECInteractionsPage({ constituentId }: BBECInteractionsPageProps) {
  const [selectedInteraction, setSelectedInteraction] = useState<BbecInteraction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [contactMethodFilter, setContactMethodFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { toast } = useToast();

  // Extract constituent ID from URL params if not provided as prop
  const params = new URLSearchParams(window.location.search);
  const currentConstituentId = constituentId || params.get('constituent');

  // Fetch BBEC interactions
  const { data: interactions = [], isLoading, error } = useQuery<BbecInteraction[]>({
    queryKey: currentConstituentId ? ['/api/bbec/interactions/by-constituent', currentConstituentId] : ['/api/bbec/interactions'],
    retry: false,
  });

  // Refresh mutation for specific constituent
  const refreshMutation = useMutation({
    mutationFn: async (constituentId: string) => {
      return await apiRequest(`/api/bbec/interactions/refresh/${constituentId}`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Interactions Refreshed",
        description: `Successfully refreshed ${data.count} interactions from BBEC`,
      });
      // Invalidate the interactions query to refetch data
      queryClient.invalidateQueries({ 
        queryKey: ['/api/bbec/interactions/by-constituent', currentConstituentId] 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh interactions from BBEC",
        variant: "destructive",
      });
    }
  });

  // Filter and sort interactions
  const filteredInteractions = useMemo(() => {
    return interactions
      .filter(interaction => {
        const matchesSearch = searchTerm === "" || 
          (interaction.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (interaction.summary || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (interaction.comment || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (interaction.lookupId || "").toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesContactMethod = contactMethodFilter === "all" || 
          (interaction.contactMethod || "").toLowerCase() === contactMethodFilter.toLowerCase();
        
        return matchesSearch && matchesContactMethod;
      })
      .sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortField) {
          case 'name':
            aValue = (a.name || "").toLowerCase();
            bValue = (b.name || "").toLowerCase();
            break;
          case 'contactMethod':
            aValue = (a.contactMethod || "").toLowerCase();
            bValue = (b.contactMethod || "").toLowerCase();
            break;
          case 'date':
            aValue = new Date(a.date).getTime();
            bValue = new Date(b.date).getTime();
            break;
          case 'lastSynced':
            aValue = new Date(a.lastSynced).getTime();
            bValue = new Date(b.lastSynced).getTime();
            break;
          default:
            aValue = new Date(a.date).getTime();
            bValue = new Date(b.date).getTime();
        }
        
        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [interactions, searchTerm, contactMethodFilter, sortField, sortDirection]);

  // Get unique contact methods for filters
  const contactMethods = useMemo(() => {
    const methods = [...new Set(interactions.map(i => i.contactMethod).filter(Boolean))].filter((m): m is string => typeof m === 'string');
    return methods.sort();
  }, [interactions]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatDate = (date: string | Date) => {
    if (!date) return "—";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (date: string | Date) => {
    if (!date) return "—";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getContactMethodColor = (method: string) => {
    switch ((method || "").toLowerCase()) {
      case 'email': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'phone': 
      case 'call': return 'bg-green-100 text-green-800 border-green-200';
      case 'meeting':
      case 'in-person': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'zoom':
      case 'video': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'letter':
      case 'mail': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppNavigation appName="BBEC Interactions" backUrl="/apps/portfolio" />
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading BBEC interactions...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppNavigation appName="BBEC Interactions" backUrl="/apps/portfolio" />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading BBEC Interactions</h3>
                <p className="text-gray-600">Failed to load interactions from BBEC. Please try again later.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const pageTitle = constituentId ? "Constituent Interactions" : "BBEC Interactions";
  const pageDescription = constituentId 
    ? "View interactions for this constituent from BBEC"
    : "View and manage interactions synced from Blackbaud CRM";

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation appName={pageTitle} />
      
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              <ExternalLink className="h-3 w-3 mr-1" />
              BBEC
            </Badge>
          </div>
          <p className="text-gray-600">{pageDescription}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Interactions</p>
                  <p className="text-xl font-semibold text-gray-900" data-testid="stat-total-bbec-interactions">
                    {interactions.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Unique Constituents</p>
                  <p className="text-xl font-semibold text-gray-900" data-testid="stat-unique-constituents">
                    {new Set(interactions.map(i => i.constituentId)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">This Month</p>
                  <p className="text-xl font-semibold text-gray-900" data-testid="stat-this-month-bbec">
                    {interactions.filter(i => {
                      if (!i.date) return false;
                      const interactionDate = new Date(i.date);
                      if (Number.isNaN(interactionDate.getTime())) return false;
                      const now = new Date();
                      return interactionDate.getMonth() === now.getMonth() && 
                             interactionDate.getFullYear() === now.getFullYear();
                    }).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                  <Filter className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Filtered Results</p>
                  <p className="text-xl font-semibold text-gray-900" data-testid="stat-filtered-bbec-results">
                    {filteredInteractions.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search interactions, names, or lookup IDs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-bbec-interactions"
                  />
                </div>
              </div>
              
              <Select value={contactMethodFilter} onValueChange={setContactMethodFilter}>
                <SelectTrigger className="w-full md:w-[180px]" data-testid="select-contact-method-filter">
                  <SelectValue placeholder="All Methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-method-all">All Methods</SelectItem>
                  {contactMethods.map(method => (
                    <SelectItem 
                      key={method} 
                      value={method} 
                      data-testid={`option-method-${(method || '').toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Interactions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>BBEC Interactions ({filteredInteractions.length})</span>
              <div className="flex items-center gap-2">
                {currentConstituentId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshMutation.mutate(currentConstituentId)}
                    disabled={refreshMutation.isPending}
                    className="flex items-center gap-1"
                    data-testid="button-refresh-interactions"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                    {refreshMutation.isPending ? 'Refreshing...' : 'Refresh'}
                  </Button>
                )}
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  Synced from BBEC
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('name')}
                      data-testid="header-constituent-name"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Constituent</span>
                        {getSortIcon('name')}
                      </div>
                    </TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('contactMethod')}
                      data-testid="header-contact-method"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Method</span>
                        {getSortIcon('contactMethod')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('date')}
                      data-testid="header-interaction-date"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Date</span>
                        {getSortIcon('date')}
                      </div>
                    </TableHead>
                    <TableHead>Lookup ID</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('lastSynced')}
                      data-testid="header-last-synced"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Last Synced</span>
                        {getSortIcon('lastSynced')}
                      </div>
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInteractions.map((interaction) => (
                    <TableRow 
                      key={interaction.id} 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedInteraction(interaction)}
                      data-testid={`row-bbec-interaction-${interaction.id}`}
                    >
                      <TableCell className="font-medium" data-testid={`cell-name-${interaction.id}`}>
                        <div>
                          <div>{interaction.name}</div>
                          {interaction.lookupId && (
                            <div className="text-xs text-gray-500">{interaction.lookupId}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell 
                        className="max-w-xs truncate" 
                        title={interaction.summary || ""}
                        data-testid={`cell-summary-${interaction.id}`}
                      >
                        {interaction.summary || "—"}
                      </TableCell>
                      <TableCell data-testid={`cell-method-${interaction.id}`}>
                        {interaction.contactMethod ? (
                          <Badge className={getContactMethodColor(interaction.contactMethod)}>
                            {interaction.contactMethod}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`cell-date-${interaction.id}`}>
                        {formatDate(interaction.date)}
                      </TableCell>
                      <TableCell data-testid={`cell-lookup-${interaction.id}`}>
                        <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                          {interaction.interactionLookupId}
                        </code>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500" data-testid={`cell-synced-${interaction.id}`}>
                        {formatDateTime(interaction.lastSynced)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInteraction(interaction);
                          }}
                          data-testid={`button-view-bbec-interaction-${interaction.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {filteredInteractions.length === 0 && (
                <div className="text-center py-8" data-testid="empty-state-bbec-interactions">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No BBEC interactions found</h3>
                  <p className="text-gray-600">
                    {searchTerm || contactMethodFilter !== "all" 
                      ? "Try adjusting your filters or search terms."
                      : "No interactions have been synced from BBEC yet."}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interaction Detail Modal */}
      <Dialog open={!!selectedInteraction} onOpenChange={() => setSelectedInteraction(null)}>
        <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-bbec-interaction-details">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span>BBEC Interaction Details</span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                <ExternalLink className="h-3 w-3 mr-1" />
                BBEC
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          {selectedInteraction && (
            <div className="space-y-4">
              <div data-testid="section-bbec-summary">
                <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
                <p className="text-gray-700" data-testid="text-bbec-summary">
                  {selectedInteraction.summary || "No summary available"}
                </p>
              </div>
              
              {selectedInteraction.comment && (
                <div data-testid="section-bbec-comment">
                  <h3 className="font-semibold text-gray-900 mb-2">Comment</h3>
                  <p className="text-gray-700 whitespace-pre-wrap" data-testid="text-bbec-comment">
                    {selectedInteraction.comment}
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4" data-testid="section-bbec-details">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Constituent</h3>
                  <p className="text-gray-700" data-testid="text-bbec-constituent-name">
                    {selectedInteraction.name}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Date</h3>
                  <p className="text-gray-700" data-testid="text-bbec-date">
                    {formatDate(selectedInteraction.date)}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Contact Method</h3>
                  {selectedInteraction.contactMethod ? (
                    <Badge className={getContactMethodColor(selectedInteraction.contactMethod)} data-testid="badge-bbec-method">
                      {selectedInteraction.contactMethod}
                    </Badge>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Lookup ID</h3>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded" data-testid="text-bbec-lookup-id">
                    {selectedInteraction.interactionLookupId}
                  </code>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-2">BBEC Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Constituent ID:</span>
                    <code className="ml-2 text-xs bg-gray-100 px-1 py-0.5 rounded">
                      {selectedInteraction.constituentId}
                    </code>
                  </div>
                  <div>
                    <span className="text-gray-500">Interaction ID:</span>
                    <code className="ml-2 text-xs bg-gray-100 px-1 py-0.5 rounded">
                      {selectedInteraction.interactionId}
                    </code>
                  </div>
                  <div>
                    <span className="text-gray-500">Last Synced:</span>
                    <span className="ml-2 text-gray-700">{formatDateTime(selectedInteraction.lastSynced)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Prospect Manager:</span>
                    <code className="ml-2 text-xs bg-gray-100 px-1 py-0.5 rounded">
                      {selectedInteraction.prospectManagerId}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}