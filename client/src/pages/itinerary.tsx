import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Map, 
  Plus, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Car, 
  Plane, 
  Route, 
  Navigation, 
  Star,
  Edit,
  Trash2,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Brain
} from "lucide-react";
import type { Itinerary, Prospect, ItineraryMeeting, UserWithRoles } from "@shared/schema";

interface ItineraryWithDetails extends Itinerary {
  meetings?: (ItineraryMeeting & { prospect: Prospect })[];
}

export default function ItineraryAI() {
  const { user } = useAuth() as { user: UserWithRoles | undefined };
  const queryClient = useQueryClient();
  const [selectedItinerary, setSelectedItinerary] = useState<number | null>(null);
  const [showNewItineraryDialog, setShowNewItineraryDialog] = useState(false);
  const [showNewMeetingDialog, setShowNewMeetingDialog] = useState(false);

  // Fetch user's itineraries
  const { data: itineraries, isLoading: loadingItineraries } = useQuery({
    queryKey: ["/api/itineraries"],
    retry: false,
  });

  // Fetch prospects for meeting selection
  const { data: prospects } = useQuery({
    queryKey: ["/api/prospects"],
    retry: false,
  });

  // Fetch selected itinerary details
  const { data: itineraryDetails } = useQuery({
    queryKey: ["/api/itineraries", selectedItinerary],
    enabled: !!selectedItinerary,
    retry: false,
  });

  // Create new itinerary mutation
  const createItineraryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/itineraries", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries"] });
      setShowNewItineraryDialog(false);
      toast({
        title: "Success",
        description: "Itinerary created successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create itinerary",
        variant: "destructive",
      });
    },
  });

  // Add meeting mutation
  const addMeetingMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/itineraries/${selectedItinerary}/meetings`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/itineraries", selectedItinerary] });
      setShowNewMeetingDialog(false);
      toast({
        title: "Success",
        description: "Meeting added to itinerary",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add meeting",
        variant: "destructive",
      });
    },
  });

  const handleCreateItinerary = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      name: formData.get("name"),
      description: formData.get("description"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      homeAddress: formData.get("homeAddress") ? JSON.parse(formData.get("homeAddress") as string) : null,
      travelMode: formData.get("travelMode"),
    };
    
    createItineraryMutation.mutate(data);
  };

  const handleAddMeeting = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      prospectId: parseInt(formData.get("prospectId") as string),
      scheduledDate: formData.get("scheduledDate"),
      scheduledTime: formData.get("scheduledTime"),
      duration: parseInt(formData.get("duration") as string),
      meetingType: formData.get("meetingType"),
      location: JSON.parse(formData.get("location") as string),
      notes: formData.get("notes"),
      sortOrder: (itineraryDetails?.meetings?.length || 0) + 1,
    };
    
    addMeetingMutation.mutate(data);
  };

  if (loadingItineraries) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Map className="h-12 w-12 animate-pulse mx-auto mb-4" style={{ color: '#CC0000' }} />
          <p className="text-gray-600">Loading your travel plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-red-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={() => window.location.href = "/"}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Apps</span>
              </Button>
              <div>
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: '#FEE2E2' }}>
                    <Map className="h-6 w-6" style={{ color: '#CC0000' }} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">itineraryAI</h1>
                    <p className="text-gray-600">AI-powered trip planning and prospect meeting optimization</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-green-50 px-3 py-2 rounded-full">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800 font-medium">AI Route Optimization</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedItinerary ? (
          <>
            {/* Itineraries Overview */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Your Trip Itineraries</h2>
                  <p className="text-gray-600">Plan and optimize your fundraising trips with AI-powered recommendations</p>
                </div>
                <Dialog open={showNewItineraryDialog} onOpenChange={setShowNewItineraryDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      className="flex items-center space-x-2 text-white"
                      style={{ backgroundColor: '#CC0000' }}
                    >
                      <Plus className="h-4 w-4" />
                      <span>New Trip</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <form onSubmit={handleCreateItinerary}>
                      <DialogHeader>
                        <DialogTitle>Create New Itinerary</DialogTitle>
                        <DialogDescription>
                          Start planning a new fundraising trip with AI-powered optimization
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 py-4">
                        <div>
                          <Label htmlFor="name">Trip Name</Label>
                          <Input
                            id="name"
                            name="name"
                            placeholder="e.g., Boston Alumni Weekend"
                            required
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            name="description"
                            placeholder="Brief description of the trip purpose"
                            rows={3}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="startDate">Start Date</Label>
                            <Input
                              id="startDate"
                              name="startDate"
                              type="date"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="endDate">End Date</Label>
                            <Input
                              id="endDate"
                              name="endDate"
                              type="date"
                              required
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="travelMode">Primary Travel Mode</Label>
                          <Select name="travelMode" defaultValue="driving">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="driving">
                                <div className="flex items-center space-x-2">
                                  <Car className="h-4 w-4" />
                                  <span>Driving</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="flying">
                                <div className="flex items-center space-x-2">
                                  <Plane className="h-4 w-4" />
                                  <span>Flying + Local Travel</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="mixed">
                                <div className="flex items-center space-x-2">
                                  <Route className="h-4 w-4" />
                                  <span>Mixed Transportation</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setShowNewItineraryDialog(false)}>
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createItineraryMutation.isPending}
                          className="text-white"
                          style={{ backgroundColor: '#CC0000' }}
                        >
                          {createItineraryMutation.isPending ? "Creating..." : "Create Trip"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Itineraries Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(itineraries || []).map((itinerary: Itinerary) => (
                  <Card 
                    key={itinerary.id}
                    className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-red-200"
                    onClick={() => setSelectedItinerary(itinerary.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold text-gray-900">
                          {itinerary.name}
                        </CardTitle>
                        <Badge 
                          variant={itinerary.status === 'completed' ? 'default' : 'secondary'}
                          className={itinerary.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                        >
                          {itinerary.status}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm">
                        {itinerary.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(itinerary.startDate).toLocaleDateString()} - {new Date(itinerary.endDate).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {itinerary.totalDistance && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Navigation className="h-4 w-4" />
                            <span>{itinerary.totalDistance} miles</span>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <MapPin className="h-4 w-4" />
                          <span>
                            {itinerary.travelMode === 'driving' && 'Road Trip'}
                            {itinerary.travelMode === 'flying' && 'Flight + Local'}
                            {itinerary.travelMode === 'mixed' && 'Mixed Travel'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {(!itineraries || itineraries.length === 0) && (
                <div className="text-center py-16">
                  <div className="mb-6">
                    <div className="w-20 h-20 mx-auto rounded-full bg-red-50 flex items-center justify-center">
                      <Map className="h-10 w-10" style={{ color: '#CC0000' }} />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Trip Itineraries Yet</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Create your first fundraising trip itinerary to start planning optimized prospect meetings with AI-powered route suggestions.
                  </p>
                  <Button 
                    onClick={() => setShowNewItineraryDialog(true)}
                    className="text-white"
                    style={{ backgroundColor: '#CC0000' }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Plan Your First Trip
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Itinerary Details View */}
            <div className="mb-6">
              <Button 
                variant="outline" 
                onClick={() => setSelectedItinerary(null)}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Itineraries
              </Button>
              
              {itineraryDetails && (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{itineraryDetails.name}</h2>
                      <p className="text-gray-600">{itineraryDetails.description}</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span>{new Date(itineraryDetails.startDate).toLocaleDateString()} - {new Date(itineraryDetails.endDate).toLocaleDateString()}</span>
                        <Badge>{itineraryDetails.status}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Trip
                      </Button>
                      <Dialog open={showNewMeetingDialog} onOpenChange={setShowNewMeetingDialog}>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm"
                            className="text-white"
                            style={{ backgroundColor: '#CC0000' }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Meeting
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <form onSubmit={handleAddMeeting}>
                            <DialogHeader>
                              <DialogTitle>Add Prospect Meeting</DialogTitle>
                              <DialogDescription>
                                Schedule a meeting with a prospect for this trip
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-4 py-4">
                              <div>
                                <Label htmlFor="prospectId">Select Prospect</Label>
                                <Select name="prospectId" required>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose a prospect" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(prospects || []).map((prospect: Prospect) => (
                                      <SelectItem key={prospect.id} value={prospect.id.toString()}>
                                        {prospect.fullName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="scheduledDate">Date</Label>
                                  <Input
                                    id="scheduledDate"
                                    name="scheduledDate"
                                    type="date"
                                    required
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="scheduledTime">Time</Label>
                                  <Input
                                    id="scheduledTime"
                                    name="scheduledTime"
                                    type="time"
                                    required
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <Label htmlFor="duration">Duration (minutes)</Label>
                                <Input
                                  id="duration"
                                  name="duration"
                                  type="number"
                                  defaultValue={60}
                                  required
                                />
                              </div>
                              
                              <div>
                                <Label htmlFor="meetingType">Meeting Type</Label>
                                <Select name="meetingType" defaultValue="visit">
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="visit">In-Person Visit</SelectItem>
                                    <SelectItem value="meal">Meal Meeting</SelectItem>
                                    <SelectItem value="event">Event/Activity</SelectItem>
                                    <SelectItem value="call">Phone Call</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div>
                                <Label htmlFor="location">Meeting Location</Label>
                                <Input
                                  id="location"
                                  name="location"
                                  placeholder='{"address": "123 Main St, City, State", "lat": 42.3601, "lng": -71.0589}'
                                  required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Enter location as JSON with address, lat, and lng
                                </p>
                              </div>
                              
                              <div>
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                  id="notes"
                                  name="notes"
                                  placeholder="Meeting objectives, preparation notes..."
                                  rows={3}
                                />
                              </div>
                            </div>
                            
                            <DialogFooter>
                              <Button type="button" variant="outline" onClick={() => setShowNewMeetingDialog(false)}>
                                Cancel
                              </Button>
                              <Button 
                                type="submit" 
                                disabled={addMeetingMutation.isPending}
                                className="text-white"
                                style={{ backgroundColor: '#CC0000' }}
                              >
                                {addMeetingMutation.isPending ? "Adding..." : "Add Meeting"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* Meetings Timeline */}
                  <Tabs defaultValue="timeline" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="timeline">Meeting Timeline</TabsTrigger>
                      <TabsTrigger value="map">Route Map</TabsTrigger>
                      <TabsTrigger value="optimization">AI Optimization</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="timeline" className="space-y-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-4">Scheduled Meetings</h3>
                        
                        {(itineraryDetails.meetings || []).length > 0 ? (
                          <div className="space-y-4">
                            {(itineraryDetails.meetings || []).map((meeting: any, index: number) => (
                              <div key={meeting.id} className="bg-white rounded-lg border p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    <div className="text-center">
                                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-sm font-semibold" style={{ color: '#CC0000' }}>
                                        {index + 1}
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="font-semibold text-gray-900">
                                        {meeting.prospect?.fullName}
                                      </h4>
                                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                                        <span className="flex items-center space-x-1">
                                          <Calendar className="h-4 w-4" />
                                          <span>{new Date(meeting.scheduledDate).toLocaleDateString()}</span>
                                        </span>
                                        <span className="flex items-center space-x-1">
                                          <Clock className="h-4 w-4" />
                                          <span>{meeting.scheduledTime}</span>
                                        </span>
                                        <span className="flex items-center space-x-1">
                                          <MapPin className="h-4 w-4" />
                                          <span>{JSON.parse(meeting.location).address}</span>
                                        </span>
                                      </div>
                                      {meeting.notes && (
                                        <p className="text-sm text-gray-700 mt-2">{meeting.notes}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Badge>{meeting.meetingType}</Badge>
                                    <Button variant="outline" size="sm">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>No meetings scheduled yet</p>
                            <p className="text-sm">Add prospect meetings to start planning your route</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="map" className="space-y-4">
                      <div className="bg-gray-50 rounded-lg p-8 text-center">
                        <Map className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Interactive Route Map</h3>
                        <p className="text-gray-600 mb-4">
                          Visual route planning with turn-by-turn directions coming soon
                        </p>
                        <Button variant="outline">
                          <Navigation className="h-4 w-4 mr-2" />
                          Generate Route Map
                        </Button>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="optimization" className="space-y-4">
                      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6">
                        <div className="flex items-center space-x-3 mb-4">
                          <Brain className="h-6 w-6" style={{ color: '#CC0000' }} />
                          <h3 className="text-lg font-semibold text-gray-900">AI-Powered Optimization</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium text-gray-700">Route Efficiency</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center space-x-2">
                                <Star className="h-4 w-4 text-yellow-500" />
                                <span className="text-sm text-gray-600">
                                  Optimize meeting order to minimize travel time
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                          
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium text-gray-700">Meeting Insights</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center space-x-2">
                                <AlertCircle className="h-4 w-4 text-blue-500" />
                                <span className="text-sm text-gray-600">
                                  Best times and venues for each prospect
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                        
                        <Button 
                          className="mt-4 text-white w-full"
                          style={{ backgroundColor: '#CC0000' }}
                        >
                          <Brain className="h-4 w-4 mr-2" />
                          Generate AI Optimization Report
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}