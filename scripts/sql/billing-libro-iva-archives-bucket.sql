-- Bucket privado para copias históricas de Libros de IVA.
-- Ejecutar a mano en el proyecto Supabase. No lo corre la aplicación.
--
-- Nombre: billing-libro-iva-archives
-- Público: no
-- Tamaño máximo: 50 MB
-- MIME: application/pdf y el MIME de .xlsx
--
-- No agrega policies para anon ni authenticated.
-- El servidor usa la service role, que omite RLS. Sin policies, el navegador
-- no puede leer ni escribir objetos de este bucket.
-- No usar URLs públicas ni firmar accesos hacia el cliente para estos archivos:
-- la descarga histórica sale por la API, después de invoices.read y del ambiente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'billing-libro-iva-archives',
  'billing-libro-iva-archives',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Por si el bucket se hubiera creado con una policy de lectura, la quita.
drop policy if exists "billing_libro_iva_archives_public_read" on storage.objects;
