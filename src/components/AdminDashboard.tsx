import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Users, FolderPlus, LogOut, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Project {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface TimeEntrySummary {
  user_id: string;
  project_id: string;
  total_hours: number;
  user_name: string;
  project_name: string;
}

const AdminDashboard = () => {
  const { signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntrySummary[]>([]);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchProjects();
    fetchUsers();
    fetchTimeEntriesSummary();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching projects",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, first_name, last_name');
      
      if (error) throw error;
      setUsers(data?.map(user => ({
        id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      })) || []);
    } catch (error: any) {
      toast({
        title: "Error fetching users",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchTimeEntriesSummary = async () => {
    try {
      // Get time entries
      const { data: timeEntriesData, error: timeEntriesError } = await supabase
        .from('time_entries')
        .select('user_id, project_id, duration_minutes')
        .not('duration_minutes', 'is', null);
      
      if (timeEntriesError) throw timeEntriesError;

      // Get user profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, first_name, last_name');
      
      if (profilesError) throw profilesError;

      // Get projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name');
      
      if (projectsError) throw projectsError;

      // Create lookup maps
      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
      const projectsMap = new Map(projectsData?.map(p => [p.id, p]) || []);
      
      // Group by user and project
      const summary: { [key: string]: TimeEntrySummary } = {};
      
      timeEntriesData?.forEach(entry => {
        const key = `${entry.user_id}-${entry.project_id}`;
        const profile = profilesMap.get(entry.user_id);
        const project = projectsMap.get(entry.project_id);
        
        if (!summary[key] && profile && project) {
          summary[key] = {
            user_id: entry.user_id,
            project_id: entry.project_id,
            total_hours: 0,
            user_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
            project_name: project.name,
          };
        }
        if (summary[key]) {
          summary[key].total_hours += (entry.duration_minutes || 0) / 60;
        }
      });
      
      setTimeEntries(Object.values(summary));
    } catch (error: any) {
      toast({
        title: "Error fetching time entries",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const createProject = async () => {
    try {
      const { error } = await supabase
        .from('projects')
        .insert({
          name: newProject.name,
          description: newProject.description,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
      
      if (error) throw error;
      toast({ title: "Project created successfully" });
      setIsProjectDialogOpen(false);
      setNewProject({ name: '', description: '' });
      fetchProjects();
    } catch (error: any) {
      toast({
        title: "Error creating project",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const assignUserToProject = async () => {
    try {
      const { error } = await supabase
        .from('project_assignments')
        .insert({
          project_id: selectedProject,
          user_id: selectedUser,
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
        });
      
      if (error) throw error;
      toast({ title: "User assigned to project successfully" });
      setIsAssignDialogOpen(false);
      setSelectedProject('');
      setSelectedUser('');
    } catch (error: any) {
      toast({
        title: "Error assigning user",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleProjectStatus = async (projectId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ is_active: !currentStatus })
        .eq('id', projectId);
      
      if (error) throw error;
      toast({ title: `Project ${!currentStatus ? 'activated' : 'deactivated'}` });
      fetchProjects();
    } catch (error: any) {
      toast({
        title: "Error updating project",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    const filteredData = timeEntries.filter(entry => {
      const matchesProject = filterProject === 'all' || entry.project_id === filterProject;
      const matchesUser = filterUser === 'all' || entry.user_id === filterUser;
      return matchesProject && matchesUser;
    });

    const csv = [
      ['User', 'Project', 'Total Hours'],
      ...filteredData.map(entry => [
        entry.user_name,
        entry.project_name,
        entry.total_hours.toFixed(2)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'time-entries.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredTimeEntries = timeEntries.filter(entry => {
    const matchesProject = filterProject === 'all' || entry.project_id === filterProject;
    const matchesUser = filterUser === 'all' || entry.user_id === filterUser;
    return matchesProject && matchesUser;
  });

  const totalHoursByUser = filteredTimeEntries.reduce((acc, entry) => {
    acc[entry.user_name] = (acc[entry.user_name] || 0) + entry.total_hours;
    return acc;
  }, {} as { [key: string]: number });

  const totalHoursByProject = filteredTimeEntries.reduce((acc, entry) => {
    acc[entry.project_name] = (acc[entry.project_name] || 0) + entry.total_hours;
    return acc;
  }, {} as { [key: string]: number });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage projects and track team productivity</p>
          </div>
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="time-entries">Time Entries</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{projects.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {projects.filter(p => p.is_active).length} active
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{users.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Hours Logged</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Object.values(totalHoursByUser).reduce((a, b) => a + b, 0).toFixed(1)}h
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-4">
              <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    Create Project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>Add a new project for time tracking</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="project-name">Project Name</Label>
                      <Input
                        id="project-name"
                        value={newProject.name}
                        onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter project name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="project-description">Description</Label>
                      <Textarea
                        id="project-description"
                        value={newProject.description}
                        onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Project description"
                      />
                    </div>
                    <Button onClick={createProject} className="w-full">
                      Create Project
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Users className="mr-2 h-4 w-4" />
                    Assign User to Project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign User to Project</DialogTitle>
                    <DialogDescription>Give a user access to a project</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Project</Label>
                      <Select value={selectedProject} onValueChange={setSelectedProject}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.filter(p => p.is_active).map(project => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>User</Label>
                      <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.first_name && user.last_name 
                                ? `${user.first_name} ${user.last_name}` 
                                : user.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={assignUserToProject} className="w-full">
                      Assign User
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Projects</CardTitle>
                <CardDescription>Manage your projects</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map(project => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        <TableCell>{project.description}</TableCell>
                        <TableCell>
                          <Badge variant={project.is_active ? "default" : "secondary"}>
                            {project.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleProjectStatus(project.id, project.is_active)}
                          >
                            {project.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="time-entries" className="space-y-6">
            {/* Filters and Export */}
            <div className="flex justify-between items-center">
              <div className="flex gap-4">
                <Select value={filterProject} onValueChange={setFilterProject}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterUser} onValueChange={setFilterUser}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}` 
                          : user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={exportToCSV} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>

            {/* Summary Tables */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Hours by User</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(totalHoursByUser).map(([user, hours]) => (
                        <TableRow key={user}>
                          <TableCell>{user}</TableCell>
                          <TableCell className="text-right">{hours.toFixed(1)}h</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Hours by Project</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(totalHoursByProject).map(([project, hours]) => (
                        <TableRow key={project}>
                          <TableCell>{project}</TableCell>
                          <TableCell className="text-right">{hours.toFixed(1)}h</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;