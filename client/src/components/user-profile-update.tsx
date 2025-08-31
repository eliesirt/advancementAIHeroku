import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User, RefreshCw, CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const userProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  buid: z.string().min(1, "BUID is required"),
  bbecGuid: z.string().optional(),
  bbecUsername: z.string().optional(),
  bbecPassword: z.string().optional(),
});

type UserProfileFormData = z.infer<typeof userProfileSchema>;

interface UserProfileUpdateProps {
  user: any;
}

export function UserProfileUpdate({ user }: UserProfileUpdateProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const { toast } = useToast();

  const form = useForm<UserProfileFormData>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      buid: user?.buid || "",
      bbecGuid: user?.bbecGuid || "",
      bbecUsername: user?.bbecUsername || "",
      bbecPassword: user?.bbecPassword || "",
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: UserProfileFormData) => {
      const response = await apiRequest("PATCH", "/api/user/profile", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated with BBEC data.",
      });
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Unable to update profile. Please verify your BUID.",
        variant: "destructive",
      });
    },
  });

  const searchUserByBuid = async (buid: string) => {
    if (!buid.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await apiRequest("GET", `/api/users/search/${buid}`);
      
      if (response.ok) {
        const userData = await response.json();
        setSearchResult(userData);
        
        // Auto-fill form with BBEC data
        form.setValue("firstName", userData.first_name || "");
        form.setValue("lastName", userData.last_name || "");
        form.setValue("email", userData.email || "");
        form.setValue("bbecGuid", userData.guid || "");
        
        toast({
          title: "User Found",
          description: "Profile information loaded from Blackbaud CRM.",
        });
      } else {
        setSearchResult(null);
        toast({
          title: "User Not Found",
          description: "No user found with this BUID in Blackbaud CRM.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setSearchResult(null);
      toast({
        title: "Search Failed",
        description: "Unable to connect to Blackbaud CRM. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = (data: UserProfileFormData) => {
    updateUserMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <User className="h-4 w-4 mr-2" />
          Update User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update User Profile</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="buid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>BUID (Blackbaud User ID)</FormLabel>
                  <div className="flex space-x-2">
                    <FormControl>
                      <Input {...field} placeholder="Enter BUID" />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => searchUserByBuid(field.value)}
                      disabled={isSearching || !field.value}
                    >
                      {isSearching ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        "Search"
                      )}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {searchResult && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Found: {searchResult.name} ({searchResult.email})
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bbecGuid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>BBEC GUID</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly className="bg-gray-50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bbecUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>BBEC Username</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter BBEC username (part before @ in email)" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bbecPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>BBEC Password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" placeholder="Enter BBEC password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? "Updating..." : "Update Profile"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}