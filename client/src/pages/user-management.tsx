import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users,
  UserPlus,
  Shield,
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Check,
  AlertTriangle,
  Crown,
  User as UserIcon,
  UserX,
  LogIn,
  LogOut
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AppNavigation } from "@/components/app-navigation";
import type { User, Role, Application, UserWithRoles, RoleWithApplications, ApplicationWithPermissions } from "@shared/schema";

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  buid: string;
  bbecGuid: string;
  isActive: boolean;
}

interface RoleFormData {
  name: string;
  description: string;
}

interface ApplicationFormData {
  name: string;
  displayName: string;
  description: string;
  route: string;
  icon: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
}

export default function UserManagementPage() {
  const [selectedTab, setSelectedTab] = useState("users");
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isAppDialogOpen, setIsAppDialogOpen] = useState(false);
  const [selectedRolePermissions, setSelectedRolePermissions] = useState<Record<number, string[]>>({});
  const { toast } = useToast();

  // Impersonation mutations
  const impersonateUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", `/api/admin/impersonate/${userId}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Impersonation Started", 
        description: data.message 
      });
      // Redirect to launcher as the impersonated user
      window.location.href = "/";
    },
    onError: (error: any) => {
      toast({ 
        title: "Impersonation Failed", 
        description: error.message || "Failed to start impersonation", 
        variant: "destructive" 
      });
    },
  });

  // Fetch all data
  const { data: users = [] } = useQuery<UserWithRoles[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
  });

  const { data: applications = [] } = useQuery<Application[]>({
    queryKey: ["/api/admin/applications"],
  });

  const { data: roleApplications = [] } = useQuery<RoleWithApplications[]>({
    queryKey: ["/api/admin/role-applications"],
  });

  // User mutations
  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormData) => {
      const response = await apiRequest("POST", "/api/admin/users", userData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to create user');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "User Created", description: "User created successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsUserDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error: Error) => {
      const errorMessage = error.message || "Failed to create user.";
      toast({ 
        title: "Create User Error", 
        description: errorMessage, 
        variant: "destructive" 
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: string; userData: Partial<UserFormData> }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${id}`, userData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to update user');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "User Updated", description: "User updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsUserDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error: Error) => {
      const errorMessage = error.message || "Failed to update user.";
      toast({ 
        title: "Update User Error", 
        description: errorMessage, 
        variant: "destructive" 
      });
    },
  });

  // Role mutations
  const createRoleMutation = useMutation({
    mutationFn: async (roleData: RoleFormData) => {
      const response = await apiRequest("POST", "/api/admin/roles", roleData);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Role Created", description: "Role created successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      setIsRoleDialogOpen(false);
      setEditingRole(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create role.", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, roleData }: { id: number; roleData: Partial<RoleFormData> }) => {
      const response = await apiRequest("PATCH", `/api/admin/roles/${id}`, roleData);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Role Updated", description: "Role updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      setIsRoleDialogOpen(false);
      setEditingRole(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update role.", variant: "destructive" });
    },
  });

  // User role assignment mutations
  const assignUserRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: number }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/roles`, { roleId });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Role Assigned", description: "User role assigned successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to assign role.", variant: "destructive" });
    },
  });

  const removeUserRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: number }) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}/roles/${roleId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Role Removed", description: "User role removed successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove role.", variant: "destructive" });
    },
  });

  // Role permissions mutations
  const updateRolePermissionsMutation = useMutation({
    mutationFn: async ({ roleId, applicationId, permissions }: { roleId: number, applicationId: number, permissions: string[] }) => {
      console.log('Updating permissions:', { roleId, applicationId, permissions });
      const response = await fetch(`/api/admin/roles/${roleId}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: parseInt(applicationId.toString()), permissions }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update permissions');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/role-applications"] });
      // Also invalidate applications cache since permissions might have changed for impersonated users
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({
        title: "Success",
        description: "Role permissions updated successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Permission update error:", error);
      toast({
        title: "Error",
        description: `Failed to update permissions: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleUserSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const userData: UserFormData = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: formData.get("email") as string,
      buid: formData.get("buid") as string,
      bbecGuid: formData.get("bbecGuid") as string,
      isActive: formData.get("isActive") === "on",
    };

    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, userData });
    } else {
      createUserMutation.mutate(userData);
    }
  };

  const handleRoleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const roleData: RoleFormData = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
    };

    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, roleData });
    } else {
      createRoleMutation.mutate(roleData);
    }
  };

  const getRolePermissions = (roleId: number, applicationId: number): string[] => {
    const role = roleApplications.find(r => r.id === roleId);
    if (!role || !role.applications) return [];
    
    const app = role.applications.find(a => a.applicationId === applicationId);
    return app?.permissions || [];
  };

  const handlePermissionChange = (roleId: number, applicationId: number, permission: string, checked: boolean) => {
    const currentPermissions = getRolePermissions(roleId, applicationId);
    let newPermissions: string[];

    if (checked) {
      newPermissions = [...new Set([...currentPermissions, permission])];
    } else {
      newPermissions = currentPermissions.filter(p => p !== permission);
    }

    updateRolePermissionsMutation.mutate({ roleId, applicationId, permissions: newPermissions });
  };

  return (
    <div className="min-h-screen bg-white">
      <AppNavigation appName="User Management" />

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-gray-50 to-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-xl" style={{ backgroundColor: '#CC0000' }}>
                <Users className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">User Management</h1>
            <p className="text-lg text-gray-600">
              Manage users, roles, and permissions for the AdvancementAI application suite
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Users</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Roles</span>
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Permissions</span>
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Users</h2>
              <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingUser(null)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleUserSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          defaultValue={editingUser?.firstName || ""}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          defaultValue={editingUser?.lastName || ""}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        defaultValue={editingUser?.email || ""}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="buid">BUID</Label>
                      <Input
                        id="buid"
                        name="buid"
                        defaultValue={editingUser?.buid || ""}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="bbecGuid">BBEC GUID</Label>
                      <Input
                        id="bbecGuid"
                        name="bbecGuid"
                        defaultValue={editingUser?.bbecGuid || ""}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isActive"
                        name="isActive"
                        defaultChecked={editingUser?.isActive ?? true}
                      />
                      <Label htmlFor="isActive">Active User</Label>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingUser ? "Update User" : "Create User"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>BUID</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <UserIcon className="h-4 w-4 text-gray-600" />
                            </div>
                            <div>
                              <div className="font-medium">{user.firstName} {user.lastName}</div>
                              <div className="text-sm text-gray-500">{user.id}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.buid}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles?.map((role) => (
                              <Badge
                                key={role.id}
                                variant={role.name === "Administrator" ? "default" : "secondary"}
                                className="flex items-center space-x-1"
                              >
                                {role.name === "Administrator" && <Crown className="h-3 w-3" />}
                                <span>{role.name}</span>
                                {!role.isSystemRole && (
                                  <button
                                    onClick={() => removeUserRoleMutation.mutate({ userId: user.id, roleId: role.id })}
                                    className="ml-1 hover:text-red-600"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </Badge>
                            ))}
                            <Select
                              onValueChange={(roleId) => assignUserRoleMutation.mutate({ userId: user.id, roleId: parseInt(roleId) })}
                            >
                              <SelectTrigger className="w-auto h-6 text-xs">
                                <Plus className="h-3 w-3" />
                              </SelectTrigger>
                              <SelectContent>
                                {roles.filter(role => 
                                  !user.roles?.some(userRole => userRole.id === role.id)
                                ).map((role) => (
                                  <SelectItem key={role.id} value={role.id.toString()}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "default" : "secondary"}>
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingUser(user);
                                setIsUserDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {/* Only show impersonate button for non-admin users */}
                            {!user.roles?.some(role => role.name === 'Administrator') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => impersonateUserMutation.mutate(user.id)}
                                disabled={impersonateUserMutation.isPending}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title={`Impersonate ${user.firstName} ${user.lastName}`}
                              >
                                <LogIn className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Roles</h2>
              <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingRole(null)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Role
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingRole ? "Edit Role" : "Add New Role"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleRoleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Role Name</Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={editingRole?.name || ""}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        name="description"
                        defaultValue={editingRole?.description || ""}
                      />
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingRole ? "Update Role" : "Create Role"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-6">
              {roles.map((role) => (
                <Card key={role.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-blue-50">
                          {role.isSystemRole ? (
                            <Crown className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Shield className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{role.name}</h3>
                          <p className="text-sm text-gray-600">{role.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {role.isSystemRole && (
                          <Badge variant="outline">System Role</Badge>
                        )}
                        {!role.isSystemRole && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingRole(role);
                              setIsRoleDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Users with this role:</h4>
                        <div className="flex flex-wrap gap-2">
                          {users.filter(user => user.roles?.some(userRole => userRole.id === role.id)).map((user) => (
                            <Badge key={user.id} variant="secondary">
                              {user.firstName} {user.lastName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Application Access:</h4>
                        <div className="grid gap-2">
                          {applications.map((app) => {
                            const permissions = getRolePermissions(role.id, app.id);
                            return (
                              <div key={app.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <span className="font-medium">{app.displayName}</span>
                                <div className="flex space-x-2">
                                  {permissions.map((permission) => (
                                    <Badge key={permission} variant="outline" className="text-xs">
                                      {permission}
                                    </Badge>
                                  ))}
                                  {permissions.length === 0 && (
                                    <Badge variant="secondary" className="text-xs">No Access</Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Role Permissions</h2>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Manage which applications each role can access and what permissions they have within those applications.
              </AlertDescription>
            </Alert>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      {applications.map((app) => (
                        <TableHead key={app.id} className="text-center">{app.displayName}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            {role.isSystemRole ? (
                              <Crown className="h-4 w-4 text-yellow-600" />
                            ) : (
                              <Shield className="h-4 w-4 text-blue-600" />
                            )}
                            <span>{role.name}</span>
                          </div>
                        </TableCell>
                        {applications.map((app) => {
                          const permissions = getRolePermissions(role.id, app.id);
                          return (
                            <TableCell key={app.id} className="text-center">
                              <div className="space-y-1">
                                {["read", "write", "admin"].map((permission) => (
                                  <div key={permission} className="flex items-center justify-center space-x-1">
                                    <Checkbox
                                      id={`${role.id}-${app.id}-${permission}`}
                                      checked={permissions.includes(permission)}
                                      onCheckedChange={(checked) => 
                                        handlePermissionChange(role.id, app.id, permission, !!checked)
                                      }
                                      disabled={role.isSystemRole || false}
                                    />
                                    <Label
                                      htmlFor={`${role.id}-${app.id}-${permission}`}
                                      className="text-xs capitalize"
                                    >
                                      {permission}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                <strong>Permission Levels:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li><strong>Read:</strong> View application data</li>
                  <li><strong>Write:</strong> Create and edit data</li>
                  <li><strong>Admin:</strong> Full access including configuration</li>
                </ul>
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}