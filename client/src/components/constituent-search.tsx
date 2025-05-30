import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, User, Building, Phone, Mail } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Constituent {
  uid: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  job_title: string;
  guid: string;
  c?: string; // capacity code
  i?: string; // inclination code
  sch_yr?: string; // school year
}

interface ConstituentSearchProps {
  lastName: string;
  onSelectConstituent: (constituent: Constituent) => void;
}

export function ConstituentSearch({ lastName, onSelectConstituent }: ConstituentSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Constituent[]>([]);
  const { toast } = useToast();

  const searchConstituents = async () => {
    if (!lastName.trim()) {
      toast({
        title: "Last Name Required",
        description: "Please enter a last name to search.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setSearchResults([]); // Clear previous results
    
    try {
      const response = await apiRequest("GET", `/api/constituents/search/${encodeURIComponent(lastName)}`);
      
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
        
        if (results.length === 0) {
          toast({
            title: "No Results",
            description: `No constituents found with last name "${lastName}".`,
          });
        } else {
          // Only open dialog after results are loaded
          setIsOpen(true);
          toast({
            title: "Search Complete",
            description: `Found ${results.length} constituent${results.length !== 1 ? 's' : ''} with last name "${lastName}".`,
          });
        }
      } else {
        toast({
          title: "Search Failed",
          description: "Unable to search constituents. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Search Error",
        description: "Unable to connect to Blackbaud CRM. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectConstituent = (constituent: Constituent) => {
    onSelectConstituent(constituent);
    setIsOpen(false);
    toast({
      title: "Constituent Selected",
      description: `Selected ${constituent.name} for this interaction.`,
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={searchConstituents}
        disabled={isSearching || !lastName.trim()}
      >
        {isSearching ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Constituent - "{lastName}"</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {searchResults.length > 0 ? (
            <div className="text-sm text-gray-600 mb-4">
              Found {searchResults.length} constituent{searchResults.length !== 1 ? 's' : ''} with last name "{lastName}"
            </div>
          ) : null}

          {searchResults.map((constituent, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => handleSelectConstituent(constituent)}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="font-semibold text-lg">{constituent.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {constituent.uid}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                    {constituent.email && (
                      <div className="flex items-center space-x-2">
                        <Mail className="h-3 w-3" />
                        <span>{constituent.email}</span>
                      </div>
                    )}
                    
                    {constituent.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-3 w-3" />
                        <span>{constituent.phone}</span>
                      </div>
                    )}
                    
                    {constituent.company && (
                      <div className="flex items-center space-x-2">
                        <Building className="h-3 w-3" />
                        <span>{constituent.company}</span>
                      </div>
                    )}
                    
                    {constituent.job_title && (
                      <div className="text-sm text-gray-500">
                        {constituent.job_title}
                      </div>
                    )}
                  </div>

                  {(constituent.c || constituent.i || constituent.sch_yr) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {constituent.c && (
                        <Badge variant="secondary" className="text-xs">
                          Capacity: {constituent.c}
                        </Badge>
                      )}
                      {constituent.i && (
                        <Badge variant="secondary" className="text-xs">
                          Inclination: {constituent.i}
                        </Badge>
                      )}
                      {constituent.sch_yr && (
                        <Badge variant="secondary" className="text-xs">
                          School: {constituent.sch_yr}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <Button variant="outline" size="sm">
                  Select
                </Button>
              </div>
            </div>
          ))}

          {searchResults.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Search className="h-8 w-8 mx-auto mb-2" />
              <p>No constituents found with last name "{lastName}"</p>
              <p className="text-sm">Try searching with a different spelling or partial name.</p>
            </div>
          )}
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
}