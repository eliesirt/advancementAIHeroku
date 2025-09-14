import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Interaction } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, Users, Calendar, MessageSquare, ArrowUpDown, Eye, ArrowUp, ArrowDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppNavigation } from "@/components/app-navigation";

type SortField = 'prospectName' | 'category' | 'actualDate' | 'status' | 'qualityScore';
type SortDirection = 'asc' | 'desc';

export default function InteractionsPage() {
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>('actualDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  

  // Fetch interactions
  const { data: interactions = [], isLoading, error } = useQuery<Interaction[]>({
    queryKey: ['/api/interactions'],
    retry: false,
  });

  // Filter and sort interactions
  const filteredInteractions = useMemo(() => {
    return interactions
      .filter(interaction => {
        const matchesSearch = searchTerm === "" || 
          (interaction.prospectName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (interaction.summary || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (interaction.comments || "").toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesCategory = categoryFilter === "all" || interaction.category === categoryFilter;
        const matchesStatus = statusFilter === "all" || interaction.status === statusFilter;
        
        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortField) {
          case 'prospectName':
            aValue = (a.prospectName || "").toLowerCase();
            bValue = (b.prospectName || "").toLowerCase();
            break;
          case 'category':
            aValue = (a.category || "").toLowerCase();
            bValue = (b.category || "").toLowerCase();
            break;
          case 'actualDate':
            aValue = new Date(a.actualDate).getTime();
            bValue = new Date(b.actualDate).getTime();
            break;
          case 'status':
            aValue = (a.status || "").toLowerCase();
            bValue = (b.status || "").toLowerCase();
            break;
          case 'qualityScore':
            aValue = a.qualityScore || 0;
            bValue = b.qualityScore || 0;
            break;
          default:
            aValue = (a.prospectName || "").toLowerCase();
            bValue = (b.prospectName || "").toLowerCase();
        }
        
        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [interactions, searchTerm, categoryFilter, statusFilter, sortField, sortDirection]);

  // Get unique categories and statuses for filters
  const categories = useMemo(() => {
    const cats = [...new Set(interactions.map(i => i.category).filter(Boolean))];
    return cats.sort();
  }, [interactions]);

  const statuses = useMemo(() => {
    const stats = [...new Set(interactions.map(i => i.status).filter(Boolean))];
    return stats.sort();
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

  const getStatusColor = (status: string) => {
    switch ((status || "").toLowerCase()) {
      case 'complete': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'draft': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryColor = (category: string) => {
    switch ((category || "").toLowerCase()) {
      case 'meeting': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'call': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'email': return 'bg-green-100 text-green-800 border-green-200';
      case 'event': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getQualityScoreColor = (score: number | null) => {
    if (!score) return 'bg-gray-100 text-gray-800';
    if (score >= 20) return 'bg-green-100 text-green-800';
    if (score >= 15) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppNavigation appName="Interactions" />
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading interactions...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppNavigation appName="Interactions" />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Interactions</h3>
                <p className="text-gray-600">Failed to load interactions. Please try again later.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNavigation appName="Interactions" />
      
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Internal App Interactions</h1>
          <p className="text-gray-600">View and manage interactions created in this application</p>
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
                  <p className="text-xl font-semibold text-gray-900" data-testid="stat-total-interactions">{interactions.length}</p>
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
                  <p className="text-sm font-medium text-gray-600">Unique Prospects</p>
                  <p className="text-xl font-semibold text-gray-900" data-testid="stat-unique-prospects">
                    {new Set(interactions.map(i => i.prospectName)).size}
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
                  <p className="text-xl font-semibold text-gray-900" data-testid="stat-this-month">
                    {interactions.filter(i => {
                      if (!i.actualDate) return false;
                      const interactionDate = new Date(i.actualDate);
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
                  <p className="text-xl font-semibold text-gray-900" data-testid="stat-filtered-results">{filteredInteractions.length}</p>
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
                    placeholder="Search interactions, prospects, or comments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-interactions"
                  />
                </div>
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[180px]" data-testid="select-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-category-all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category} data-testid={`option-category-${category.toLowerCase()}`}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]" data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-status-all">All Statuses</SelectItem>
                  {statuses.map(status => (
                    <SelectItem key={status} value={status} data-testid={`option-status-${status.toLowerCase()}`}>{status}</SelectItem>
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
              <span>Interactions ({filteredInteractions.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('prospectName')}
                      data-testid="header-prospect-name"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Prospect</span>
                        {sortField === 'prospectName' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        ) : (
                          <ArrowUpDown className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('category')}
                      data-testid="header-category"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Category</span>
                        {sortField === 'category' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        ) : (
                          <ArrowUpDown className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('actualDate')}
                      data-testid="header-date"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Date</span>
                        {sortField === 'actualDate' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        ) : (
                          <ArrowUpDown className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('status')}
                      data-testid="header-status"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Status</span>
                        {sortField === 'status' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        ) : (
                          <ArrowUpDown className="h-4 w-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('qualityScore')}
                      data-testid="header-quality"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Quality</span>
                        {sortField === 'qualityScore' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                        ) : (
                          <ArrowUpDown className="h-4 w-4" />
                        )}
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
                      data-testid={`row-interaction-${interaction.id}`}
                    >
                      <TableCell className="font-medium" data-testid={`cell-prospect-${interaction.id}`}>
                        {interaction.prospectName}
                        {interaction.bbecSubmitted && (
                          <Badge className="ml-2 bg-green-100 text-green-800 text-xs" data-testid={`badge-bbec-${interaction.id}`}>BBEC</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={interaction.summary} data-testid={`cell-summary-${interaction.id}`}>
                        {interaction.summary}
                      </TableCell>
                      <TableCell data-testid={`cell-category-${interaction.id}`}>
                        <Badge className={getCategoryColor(interaction.category)}>
                          {interaction.category}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`cell-date-${interaction.id}`}>{formatDate(interaction.actualDate)}</TableCell>
                      <TableCell data-testid={`cell-status-${interaction.id}`}>
                        <Badge className={getStatusColor(interaction.status)}>
                          {interaction.status}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`cell-quality-${interaction.id}`}>
                        {interaction.qualityScore ? (
                          <Badge className={getQualityScoreColor(interaction.qualityScore)}>
                            {interaction.qualityScore}/25
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInteraction(interaction);
                          }}
                          data-testid={`button-view-interaction-${interaction.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {filteredInteractions.length === 0 && (
                <div className="text-center py-8" data-testid="empty-state-interactions">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No interactions found</h3>
                  <p className="text-gray-600">
                    {searchTerm || categoryFilter !== "all" || statusFilter !== "all" 
                      ? "Try adjusting your filters or search terms."
                      : "Start by creating your first interaction."}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedInteraction} onOpenChange={(open) => !open && setSelectedInteraction(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-interaction-details">
          <DialogHeader>
            <DialogTitle>Interaction Details</DialogTitle>
          </DialogHeader>
          {selectedInteraction && (
            <div className="space-y-4">
              <div data-testid="section-summary">
                <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
                <p className="text-gray-700" data-testid="text-summary">{selectedInteraction.summary}</p>
              </div>
              
              {selectedInteraction.comments && (
                <div data-testid="section-comments">
                  <h3 className="font-semibold text-gray-900 mb-2">Comments</h3>
                  <p className="text-gray-700 whitespace-pre-wrap" data-testid="text-comments">{selectedInteraction.comments}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4" data-testid="section-details">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Prospect</h3>
                  <p className="text-gray-700" data-testid="text-prospect-name">{selectedInteraction.prospectName}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Date</h3>
                  <p className="text-gray-700" data-testid="text-date">{formatDate(selectedInteraction.actualDate)}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Category</h3>
                  <Badge className={getCategoryColor(selectedInteraction.category)} data-testid="badge-category">
                    {selectedInteraction.category}
                  </Badge>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Status</h3>
                  <Badge className={getStatusColor(selectedInteraction.status)} data-testid="badge-status">
                    {selectedInteraction.status}
                  </Badge>
                </div>
              </div>
              
              {selectedInteraction.affinityTags && selectedInteraction.affinityTags.length > 0 && (
                <div data-testid="section-affinity-tags">
                  <h3 className="font-semibold text-gray-900 mb-2">Affinity Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedInteraction.affinityTags.map((tag, index) => (
                      <Badge key={index} variant="outline" data-testid={`tag-${index}`}>{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedInteraction.qualityScore && (
                <div data-testid="section-quality">
                  <h3 className="font-semibold text-gray-900 mb-2">Quality Assessment</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">Score:</span>
                      <Badge className={getQualityScoreColor(selectedInteraction.qualityScore)} data-testid="badge-quality-score">
                        {selectedInteraction.qualityScore}/25
                      </Badge>
                    </div>
                    {selectedInteraction.qualityExplanation && (
                      <p className="text-sm text-gray-700" data-testid="text-quality-explanation">{selectedInteraction.qualityExplanation}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}