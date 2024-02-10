export default defineNuxtRouteMiddleware((to, from) => {
  const authStore = useAuthStore();
  const token = useCookie("token");

  if (token.value) {
    authStore.authenticated = true;
  }
});
