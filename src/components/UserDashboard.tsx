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
import { Play, Pause, Clock, Plus, LogOut } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Project {
  id: string;
  name: string;
  description: string;
}

interface TimeEntry {
  id: string;
  description: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  is_running: boolean;
  project_id: string;
  projects: {
    name: string;
  };
}

const UserDashboard = () => {
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [newEntry, setNewEntry] = useState({
    project_id: '',
    description: '',
    start_time: '',
    end_time: '',
  });

  useEffect(() => {
    fetchProjects();
    fetchTimeEntries();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, description')
        .eq('is_active', true);
      
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

  const fetchTimeEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          id,
          description,
          start_time,
          end_time,
          duration_minutes,
          is_running,
          project_id,
          projects!inner(name)
        `)
        .order('start_time', { ascending: false });
      
      if (error) throw error;
      setTimeEntries(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching time entries",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const startTimer = async (projectId: string, description: string = '') => {
    try {
      const { error } = await supabase
        .from('time_entries')
        .insert({
          user_id: user?.id,
          project_id: projectId,
          description,
          start_time: new Date().toISOString(),
          is_running: true,
        });
      
      if (error) throw error;
      toast({ title: "Timer started" });
      fetchTimeEntries();
    } catch (error: any) {
      toast({
        title: "Error starting timer",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const stopTimer = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          end_time: new Date().toISOString(),
          is_running: false,
        })
        .eq('id', entryId);
      
      if (error) throw error;
      toast({ title: "Timer stopped" });
      fetchTimeEntries();
    } catch (error: any) {
      toast({
        title: "Error stopping timer",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const createManualEntry = async () => {
    try {
      const { error } = await supabase
        .from('time_entries')
        .insert({
          user_id: user?.id,
          project_id: newEntry.project_id,
          description: newEntry.description,
          start_time: newEntry.start_time,
          end_time: newEntry.end_time,
          is_running: false,
        });
      
      if (error) throw error;
      toast({ title: "Time entry created" });
      setIsCreateDialogOpen(false);
      setNewEntry({ project_id: '', description: '', start_time: '', end_time: '' });
      fetchTimeEntries();
    } catch (error: any) {
      toast({
        title: "Error creating entry",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const runningEntry = timeEntries.find(entry => entry.is_running);

  const filteredEntries = timeEntries.filter(entry => {
    const matchesProject = filterProject === 'all' || entry.project_id === filterProject;
    const matchesDate = !filterDate || entry.start_time.startsWith(filterDate);
    return matchesProject && matchesDate;
  });

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Time Tracker</h1>
            <p className="text-muted-foreground">Track your work hours</p>
          </div>
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Quick Timer */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Timer</CardTitle>
            <CardDescription>Start tracking time for a project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {runningEntry ? (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{runningEntry.projects.name}</p>
                  <p className="text-sm text-muted-foreground">{runningEntry.description}</p>
                  <p className="text-sm">Started: {format(new Date(runningEntry.start_time), 'HH:mm')}</p>
                </div>
                <Button onClick={() => stopTimer(runningEntry.id)} variant="destructive">
                  <Pause className="mr-2 h-4 w-4" />
                  Stop Timer
                </Button>
              </div>
            ) : (
              <div className="flex gap-4">
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={() => startTimer(selectedProject)} 
                  disabled={!selectedProject}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Timer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Entry and Filters */}
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
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-48"
            />
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Manual Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Time Entry</DialogTitle>
                <DialogDescription>Add a manual time entry</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="project">Project</Label>
                  <Select value={newEntry.project_id} onValueChange={(value) => 
                    setNewEntry(prev => ({ ...prev, project_id: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newEntry.description}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="What did you work on?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input
                      id="start_time"
                      type="datetime-local"
                      value={newEntry.start_time}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, start_time: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_time">End Time</Label>
                    <Input
                      id="end_time"
                      type="datetime-local"
                      value={newEntry.end_time}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, end_time: e.target.value }))}
                    />
                  </div>
                </div>
                <Button onClick={createManualEntry} className="w-full">
                  Create Entry
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Time Entries */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Time Entries</CardTitle>
            <CardDescription>Your logged work hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredEntries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{entry.projects.name}</h4>
                      {entry.is_running && (
                        <Badge variant="secondary">
                          <Clock className="mr-1 h-3 w-3" />
                          Running
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.description}</p>
                    <p className="text-sm">
                      {format(new Date(entry.start_time), 'MMM dd, yyyy HH:mm')}
                      {entry.end_time && ` - ${format(new Date(entry.end_time), 'HH:mm')}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {entry.is_running ? 'Running...' : formatDuration(entry.duration_minutes)}
                    </p>
                  </div>
                </div>
              ))}
              {filteredEntries.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No time entries found
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserDashboard;