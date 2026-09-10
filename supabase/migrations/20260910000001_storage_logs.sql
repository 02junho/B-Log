-- 업로드 원본 로그 저장용 비공개 버킷. 접근은 service_role만 (RLS 정책 없음).
insert into storage.buckets (id, name, public)
values ('logs', 'logs', false)
on conflict (id) do nothing;
