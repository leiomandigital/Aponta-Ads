create table sync_logs (
  id uuid primary key default gen_random_uuid(),
  integration_key text not null references integrations(key) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('success', 'error', 'partial')),
  records_synced int not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_sync_logs_integration_key on sync_logs(integration_key);
create index idx_sync_logs_started_at on sync_logs(started_at);

alter table sync_logs enable row level security;

create policy "authenticated_full_access"
  on sync_logs for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
