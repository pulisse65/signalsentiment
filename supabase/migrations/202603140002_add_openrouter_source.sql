insert into sources (source, enabled)
values ('openrouter', true)
on conflict (source) do nothing;
