export function getPostLoginRedirectPath(supplier: boolean) {
  return supplier ? "/suppliers/dashboard" : "/";
}

export function getPostPaymentRedirectPath() {
  return "/account";
}
