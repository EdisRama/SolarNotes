create table if not exists public.solar_notes_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint solar_notes_data_shape check (
    jsonb_typeof(data) = 'object'
    and coalesce(jsonb_typeof(data -> 'notes') = 'array', false)
    and coalesce(jsonb_typeof(data -> 'categories') = 'array', false)
    and coalesce(jsonb_typeof(data -> 'tasks') = 'array', false)
    and coalesce(jsonb_typeof(data -> 'events') = 'array', false)
  )
);

alter table public.solar_notes_data enable row level security;
revoke all on public.solar_notes_data from anon, authenticated;
grant select, insert, update on public.solar_notes_data to authenticated;

drop policy if exists "Users can read their Solar Notes data" on public.solar_notes_data;
create policy "Users can read their Solar Notes data"
  on public.solar_notes_data for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their Solar Notes data" on public.solar_notes_data;
create policy "Users can create their Solar Notes data"
  on public.solar_notes_data for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their Solar Notes data" on public.solar_notes_data;
create policy "Users can update their Solar Notes data"
  on public.solar_notes_data for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
