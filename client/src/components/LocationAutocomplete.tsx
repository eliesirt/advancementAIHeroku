import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2 } from 'lucide-react';

interface LocationResult {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface LocationDetails {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates: {
    lat: number;
    lng: number;
  } | null;
}

interface LocationAutocompleteProps {
  name: string;
  placeholder?: string;
  value?: string;
  onChange?: (location: LocationDetails) => void;
  required?: boolean;
  className?: string;
}

export function LocationAutocomplete({ 
  name, 
  placeholder = "Enter address or location", 
  value = "",
  onChange,
  required = false,
  className = ""
}: LocationAutocompleteProps) {
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationDetails | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // Google Places API autocomplete
  const searchPlaces = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.predictions || []);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching places:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get place details
  const getPlaceDetails = async (placeId: string): Promise<LocationDetails> => {
    try {
      const response = await fetch(`/api/places/details?place_id=${placeId}`);
      if (response.ok) {
        const data = await response.json();
        const result = data.result;
        
        const location: LocationDetails = {
          address: result.formatted_address || '',
          city: '',
          state: '',
          zipCode: '',
          coordinates: result.geometry?.location ? {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng
          } : null
        };

        // Parse address components
        if (result.address_components) {
          result.address_components.forEach((component: any) => {
            const types = component.types;
            if (types.includes('locality')) {
              location.city = component.long_name;
            } else if (types.includes('administrative_area_level_1')) {
              location.state = component.short_name;
            } else if (types.includes('postal_code')) {
              location.zipCode = component.long_name;
            }
          });
        }

        return location;
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    }

    // Fallback to simple address format
    return {
      address: input,
      city: '',
      state: '',
      zipCode: '',
      coordinates: null
    };
  };

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchPlaces(value);
    }, 300);
  };

  // Handle suggestion selection
  const handleSuggestionClick = async (suggestion: LocationResult) => {
    setInput(suggestion.description);
    setShowSuggestions(false);
    
    const locationDetails = await getPlaceDetails(suggestion.place_id);
    setSelectedLocation(locationDetails);
    
    // Update hidden input with JSON data
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = JSON.stringify(locationDetails);
    }
    
    // Call onChange callback
    if (onChange) {
      onChange(locationDetails);
    }
  };

  // Handle manual input (when user types without selecting from suggestions)
  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
      
      // If user typed something but didn't select from suggestions
      if (input && !selectedLocation) {
        const manualLocation: LocationDetails = {
          address: input,
          city: '',
          state: '',
          zipCode: '',
          coordinates: null
        };
        setSelectedLocation(manualLocation);
        
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = JSON.stringify(manualLocation);
        }
        
        if (onChange) {
          onChange(manualLocation);
        }
      }
    }, 200);
  };

  useEffect(() => {
    setInput(value);
  }, [value]);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Input
          type="text"
          value={input}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="pr-8"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <MapPin className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Hidden input for form submission */}
      <input
        ref={hiddenInputRef}
        type="hidden"
        name={name}
        required={required}
        defaultValue={selectedLocation ? JSON.stringify(selectedLocation) : ""}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {suggestion.structured_formatting.main_text}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {suggestion.structured_formatting.secondary_text}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}