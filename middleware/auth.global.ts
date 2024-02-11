export default defineNuxtRouteMiddleware(async (to, from) => {
  const authStore = useAuthStore();
  const token = useCookie("token");

  if (token.value) {
    authStore.authenticated = true;
  } else {
    authStore.authenticated = false;
    authStore.user = null;
  }
});
