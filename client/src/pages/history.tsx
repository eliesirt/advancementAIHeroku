import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  Filter, 
  CheckCircle, 
  Clock, 
  Edit, 
  Calendar,
  User,
  Tag
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Interaction } from "@shared/schema";

interface HistoryPageProps {
  initialFilter?: "all" | "pending" | "drafts" | "synced";
}

export default function HistoryPage({ initialFilter = "all" }: HistoryPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [sortBy, setSortBy] = useState("date");

  // Fetch all interactions
  const { data: interactions = [], isLoading } = useQuery<Interaction[]>({
    queryKey: ["/api/interactions"],
  });

  // Filter and sort interactions
  const filteredInteractions = useMemo(() => {
    let filtered = interactions.filter((interaction) => {
      // Search filter
      const matchesSearch = searchTerm === "" || 
        interaction.prospectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        interaction.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (interaction.comments && interaction.comments.toLowerCase().includes(searchTerm.toLowerCase()));

      // Category filter
      const matchesCategory = categoryFilter === "all" || interaction.category === categoryFilter;

      // Status filter
      let matchesStatus = true;
      if (statusFilter === "pending") {
        matchesStatus = !interaction.bbecSubmitted && !interaction.isDraft;
      } else if (statusFilter === "drafts") {
        matchesStatus = interaction.isDraft;
      } else if (statusFilter === "synced") {
        matchesStatus = interaction.bbecSubmitted;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });

    // Sort interactions
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date":
          return new Date(b.actualDate).getTime() - new Date(a.actualDate).getTime();
        case "created":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "prospect":
          return a.prospectName.localeCompare(b.prospectName);
        case "category":
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

    return filtered;
  }, [interactions, searchTerm, categoryFilter, statusFilter, sortBy]);

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  const getStatusInfo = (interaction: Interaction) => {
    if (interaction.bbecSubmitted) {
      return {
        icon: <CheckCircle className="h-4 w-4 text-green-600" />,
        text: "Synced to BBEC",
        color: "text-green-600",
        badge: "bg-green-100 text-green-800"
      };
    }
    if (interaction.isDraft) {
      return {
        icon: <Edit className="h-4 w-4 text-yellow-600" />,
        text: "Draft",
        color: "text-yellow-600",
        badge: "bg-yellow-100 text-yellow-800"
      };
    }
    return {
      icon: <Clock className="h-4 w-4 text-blue-600" />,
      text: "Pending submission",
      color: "text-blue-600",
      badge: "bg-blue-100 text-blue-800"
    };
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Cultivation":
        return "🌱";
      case "Stewardship":
        return "🤝";
      case "Solicitation":
        return "💼";
      case "Research":
        return "🔍";
      default:
        return "📝";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-semibold text-gray-900">
          {initialFilter === "pending" ? "Pending Interactions" : "Interaction History"}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {filteredInteractions.length} of {interactions.length} interactions
        </p>
      </header>

      <main className="p-4 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search interactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="synced">Synced</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="drafts">Drafts</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Cultivation">Cultivation</SelectItem>
                  <SelectItem value="Stewardship">Stewardship</SelectItem>
                  <SelectItem value="Solicitation">Solicitation</SelectItem>
                  <SelectItem value="Research">Research</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Interaction Date</SelectItem>
                  <SelectItem value="created">Created Date</SelectItem>
                  <SelectItem value="prospect">Prospect Name</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Interactions List */}
        <div className="space-y-3">
          {filteredInteractions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-gray-400 mb-4">
                  {searchTerm || categoryFilter !== "all" || statusFilter !== "all" ? (
                    <>
                      <Search className="h-12 w-12 mx-auto mb-4" />
                      <p className="font-medium">No interactions match your filters</p>
                      <p className="text-sm">Try adjusting your search criteria</p>
                    </>
                  ) : (
                    <>
                      <Calendar className="h-12 w-12 mx-auto mb-4" />
                      <p className="font-medium">No interactions recorded yet</p>
                      <p className="text-sm">Start by logging your first interaction</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredInteractions.map((interaction) => {
              const statusInfo = getStatusInfo(interaction);
              
              return (
                <Card key={interaction.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <User className="h-4 w-4 text-gray-500" />
                          <h3 className="font-semibold text-gray-900 truncate">
                            {interaction.prospectName}
                          </h3>
                        </div>
                        <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                          {interaction.summary}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1 ml-2">
                        {statusInfo.icon}
                      </div>
                    </div>

                    {/* Interaction Details */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge variant="secondary" className="text-xs">
                        {getCategoryIcon(interaction.category)} {interaction.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {interaction.method}
                      </Badge>
                      <Badge className={`text-xs ${statusInfo.badge}`}>
                        {statusInfo.text}
                      </Badge>
                    </div>

                    {/* Affinity Tags */}
                    {interaction.affinityTags && interaction.affinityTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {interaction.affinityTags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                        {interaction.affinityTags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{interaction.affinityTags.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-3 w-3" />
                        <span>Interaction: {formatDate(interaction.actualDate)}</span>
                      </div>
                      <span>Logged: {formatDate(interaction.createdAt)}</span>
                    </div>

                    {/* 48-hour compliance warning */}
                    {!interaction.bbecSubmitted && !interaction.isDraft && (
                      (() => {
                        const hoursDiff = (new Date().getTime() - new Date(interaction.actualDate).getTime()) / (1000 * 60 * 60);
                        if (hoursDiff > 48) {
                          return (
                            <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                              ⚠️ This interaction is {Math.round(hoursDiff - 48)} hours past the 48-hour SOP deadline
                            </div>
                          );
                        }
                        return null;
                      })()
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Load More Button */}
        {filteredInteractions.length > 0 && filteredInteractions.length >= 20 && (
          <div className="text-center pt-4">
            <Button variant="outline">
              Load More Interactions
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
