
-- Fix the RLS policy for projects to correctly show assigned projects to users
DROP POLICY "Users can view assigned projects" ON public.projects;

CREATE POLICY "Users can view assigned projects" 
ON public.projects 
FOR SELECT 
USING ((EXISTS ( SELECT 1
   FROM project_assignments
  WHERE ((project_assignments.project_id = projects.id) AND (project_assignments.user_id = auth.uid())))) OR has_role(auth.uid(), 'admin'::app_role));
