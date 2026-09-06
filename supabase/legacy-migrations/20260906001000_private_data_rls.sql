begin;
revoke all on public.contact_messages from anon, authenticated;
grant select on public.contact_messages to authenticated;
create policy owner_read on public.contact_messages for select to authenticated using ((select private.is_portfolio_admin()));
revoke all on public.analytics_events from anon, authenticated;
grant select on public.analytics_events to authenticated;
create policy owner_read on public.analytics_events for select to authenticated using ((select private.is_portfolio_admin()));
revoke all on public.analytics_daily from anon, authenticated;
grant select on public.analytics_daily to authenticated;
create policy owner_read on public.analytics_daily for select to authenticated using ((select private.is_portfolio_admin()));
revoke all on public.analytics_daily_content from anon, authenticated;
grant select on public.analytics_daily_content to authenticated;
create policy owner_read on public.analytics_daily_content for select to authenticated using ((select private.is_portfolio_admin()));
revoke all on public.admin_activity from anon, authenticated;
grant select on public.admin_activity to authenticated;
create policy owner_read on public.admin_activity for select to authenticated using ((select private.is_portfolio_admin()));
revoke all on public.site_builds from anon, authenticated;
grant select on public.site_builds to authenticated;
create policy owner_read on public.site_builds for select to authenticated using ((select private.is_portfolio_admin()));
grant update (status) on public.contact_messages to authenticated;
create policy owner_message_status on public.contact_messages for update to authenticated
  using ((select private.is_portfolio_admin())) with check ((select private.is_portfolio_admin()));
grant select on private.analytics_daily_dimensions to authenticated;
create policy owner_read on private.analytics_daily_dimensions for select to authenticated using ((select private.is_portfolio_admin()));
create view public.admin_analytics_daily_dimensions with (security_invoker = true, security_barrier = true)
as select * from private.analytics_daily_dimensions;
revoke all on public.admin_analytics_daily_dimensions from public, anon, authenticated;
grant select on public.admin_analytics_daily_dimensions to authenticated;
grant select on private.analytics_daily_sessions to authenticated;
create policy owner_read on private.analytics_daily_sessions for select to authenticated using ((select private.is_portfolio_admin()));
create view public.admin_analytics_daily_sessions with (security_invoker = true, security_barrier = true)
as select * from private.analytics_daily_sessions;
revoke all on public.admin_analytics_daily_sessions from public, anon, authenticated;
grant select on public.admin_analytics_daily_sessions to authenticated;
-- Only explicit backend privileges, never client keys. No Edge logic is deployed in F6.
grant insert on public.contact_messages, public.analytics_events, public.admin_activity to service_role;
grant select, insert, update on public.analytics_daily, public.analytics_daily_content, public.site_builds to service_role;
grant update (notification_status) on public.contact_messages to service_role;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.analytics_daily_dimensions, private.analytics_daily_sessions, private.rate_limit_buckets to service_role;
commit;
