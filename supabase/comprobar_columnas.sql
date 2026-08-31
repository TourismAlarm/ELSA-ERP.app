-- Comprueba que existen todas las columnas que la aplicación escribe.
--
-- Se añadió al detectar que el formulario de Configuración guardaba
-- adminWhatsapp y adminEmail sin que esas columnas existieran: la app fallaba
-- al guardar y no había forma de verlo hasta que alguien se topaba con ello.
--
-- Ejecutar en el SQL Editor después de cualquier cambio de esquema.
-- Si no devuelve ninguna fila, está todo en su sitio.

with esperadas(tabla, columna) as (values
  ('config','nombre'), ('config','tel'), ('config','email'), ('config','direccion'),
  ('config','logo'), ('config','vehicles'), ('config','adminWhatsapp'), ('config','adminEmail'),

  ('clientes','numero'), ('clientes','nombre'), ('clientes','nombre_comercial'),
  ('clientes','nifCif'), ('clientes','dirFact'), ('clientes','cp'), ('clientes','poblacion'),
  ('clientes','provincia'), ('clientes','tel'), ('clientes','movil'), ('clientes','email'),

  ('solicitudes','numero'), ('solicitudes','cliente'), ('solicitudes','cliente_id'),
  ('solicitudes','vehiculo'), ('solicitudes','origen'), ('solicitudes','destino'),
  ('solicitudes','metros'), ('solicitudes','peso'), ('solicitudes','bultos'),
  ('solicitudes','descripcion'), ('solicitudes','precio'), ('solicitudes','fotos'),
  ('solicitudes','estado'), ('solicitudes','fecha_ultimo_contacto'),
  ('solicitudes','notas_seguimiento'), ('solicitudes','avisos_activos'), ('solicitudes','created_at'),

  ('servicios','numero'), ('servicios','cliente'), ('servicios','cliente_id'),
  ('servicios','vehiculo'), ('servicios','origen'), ('servicios','destino'),
  ('servicios','fecha_servicio'), ('servicios','hora_inicio'), ('servicios','hora_fin'),
  ('servicios','descripcion'), ('servicios','precio'), ('servicios','fotos'),
  ('servicios','estado'), ('servicios','notas'), ('servicios','solicitud_id'),

  ('albaranes','numero'), ('albaranes','cliente'), ('albaranes','fecha'),
  ('albaranes','descripcion'), ('albaranes','lineas'), ('albaranes','fotos'),
  ('albaranes','servicio_id'), ('albaranes','estado'), ('albaranes','firma'),
  ('albaranes','firmado_por'), ('albaranes','firmado_en'),

  ('vehiculos','nombre'), ('vehiculos','matricula'), ('vehiculos','tipo'),
  ('vehiculos','itv_vencimiento'), ('vehiculos','seguro_vencimiento'),
  ('vehiculos','notas'), ('vehiculos','vencimientos'), ('vehiculos','fotos'), ('vehiculos','activo'),

  ('mantenimientos','vehiculo_id'), ('mantenimientos','fecha'), ('mantenimientos','descripcion'),
  ('mantenimientos','taller'), ('mantenimientos','coste'), ('mantenimientos','km')
)
select e.tabla, e.columna, 'FALTA EN LA BASE DE DATOS' as problema
from esperadas e
left join information_schema.columns c
  on  c.table_schema = 'public'
  and c.table_name   = e.tabla
  and c.column_name  = e.columna
where c.column_name is null
order by e.tabla, e.columna;
