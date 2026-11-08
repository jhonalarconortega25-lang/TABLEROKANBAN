-- Project Planner · Esquema relacional para Supabase (PostgreSQL)
-- Ejecutar en: Supabase → SQL Editor. Luego definir VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.

create table if not exists project (
  id text primary key default 'main',
  name text not null,
  description text not null default '',
  start_date date not null,
  end_date date not null,
  weighting_mode text not null default 'equal' check (weighting_mode in ('equal','weighted'))
);

create table if not exists members (
  id text primary key,
  name text not null,
  role text not null default '',
  email text,
  avatar_url text,
  color_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists sprints (
  id text primary key,
  number int not null,
  name text not null,
  goal text not null default '',
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  owner_id text references members(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','active','finished')),
  created_at timestamptz not null default now()
);

create table if not exists meetings (
  id text primary key,
  title text not null,
  date date not null,
  time text not null,
  duration_min int not null default 60,
  participant_ids text[] not null default '{}',       -- ids de members
  objective text not null default '',
  agenda text not null default '',
  agreements text not null default '',
  action_items jsonb not null default '[]',            -- [{id,text,assigneeId,taskId}]
  sprint_id text references sprints(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id text primary key,
  title text not null,
  description text not null default '',
  assignee_id text references members(id) on delete set null,
  collaborator_ids text[] not null default '{}',
  start_date date,
  due_date date,
  status text not null default 'pending' check (status in ('pending','in_progress','review','done')),
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  sprint_id text references sprints(id) on delete set null,
  phase text not null default '',
  checklist jsonb not null default '[]',               -- [{id,text,done}]
  comments jsonb not null default '[]',                -- [{id,authorId,text,createdAt}]
  attachments jsonb not null default '[]',             -- [{id,name,url,size,mime,addedAt}]
  weight int not null default 1 check (weight between 1 and 5),  -- ponderación futura
  meeting_id text references meetings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists tasks_sprint_idx on tasks(sprint_id);
create index if not exists tasks_assignee_idx on tasks(assignee_id);
create index if not exists tasks_due_idx on tasks(due_date);

create table if not exists milestones (
  id text primary key,
  title text not null,
  date date not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists history (
  id text primary key,
  at timestamptz not null default now(),
  entity text not null,
  entity_id text,
  action text not null,
  summary text not null
);
create index if not exists history_at_idx on history(at desc);

-- Tiempo real (se puede ejecutar varias veces sin error)
do $$
declare t text;
begin
  foreach t in array array['project','members','sprints','meetings','tasks','milestones','history'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Permisos para la app (clave anon, sin inicio de sesión)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on project, members, sprints, meetings, tasks, milestones, history to anon, authenticated;

-- Seguridad (RLS): cualquiera con el enlace de la app puede ver y editar (sin cuentas).
do $$
declare t text;
begin
  foreach t in array array['project','members','sprints','meetings','tasks','milestones','history'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "team_access" on %I', t);
    execute format('create policy "team_access" on %I for all using (true) with check (true)', t);
  end loop;
end $$;
