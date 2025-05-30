import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";

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

interface BuidSearchProps {
  buid: string;
  onSelectConstituent: (constituent: Constituent) => void;
}

export function BuidSearch({ buid, onSelectConstituent }: BuidSearchProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: constituents = [], isLoading, error } = useQuery<Constituent[]>({
    queryKey: ['/api/constituents/search-by-buid', buid],
    enabled: isOpen && buid.trim().length > 0,
    retry: false,
  });

  const handleSearch = () => {
    if (buid.trim().length === 0) {
      return;
    }
    setIsOpen(true);
  };

  const handleSelectConstituent = (constituent: Constituent) => {
    onSelectConstituent(constituent);
    setIsOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSearch}
        disabled={!buid.trim()}
        className="shrink-0"
      >
        <Search className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search Results for BUID: {buid}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {isLoading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Searching...</p>
              </div>
            )}

            {error && (
              <div className="text-center py-4 text-red-600">
                <p>Error searching for constituent. Please try again.</p>
              </div>
            )}

            {!isLoading && !error && constituents.length === 0 && (
              <div className="text-center py-4 text-gray-600">
                <p>No constituents found with BUID: {buid}</p>
              </div>
            )}

            {constituents.map((constituent) => (
              <div
                key={constituent.uid}
                className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleSelectConstituent(constituent)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{constituent.name}</h3>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-600">
                      <div><strong>BUID:</strong> {constituent.uid}</div>
                      <div><strong>BBEC GUID:</strong> {constituent.guid}</div>
                      {constituent.email && (
                        <div><strong>Email:</strong> {constituent.email}</div>
                      )}
                      {constituent.phone && (
                        <div><strong>Phone:</strong> {constituent.phone}</div>
                      )}
                      {constituent.job_title && (
                        <div><strong>Job Title:</strong> {constituent.job_title}</div>
                      )}
                      {constituent.company && (
                        <div><strong>Company:</strong> {constituent.company}</div>
                      )}
                      {constituent.sch_yr && (
                        <div><strong>School:</strong> {constituent.sch_yr}</div>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Select
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}