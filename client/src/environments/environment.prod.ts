export const environment = {
  production: true,
  /**
   * The API serves this app from its own origin (the ExaMaster Azure Web App),
   * so API calls and the notifications hub (/hubs/notifications) are relative.
   */
  apiUrl: '/api'
};
