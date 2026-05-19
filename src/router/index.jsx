export const ROUTES = {
  dashboard:       '/',
  login:           '/login',
  solicitudNueva:  '/solicitud/nueva',
  solicitudVer:    (id) => `/solicitud/${id}`,
  solicitudEditar: (id) => `/solicitud/${id}/editar`,
  clientes:        '/clientes',
  config:          '/config',
};
