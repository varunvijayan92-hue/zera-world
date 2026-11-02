export function getPostLoginRedirectPath(supplier: boolean, next?: string) {
  return supplier ? "/suppliers/dashboard" : next === "/checkout/payment" ? next : "/";
}

export function getPostPaymentRedirectPath() {
  return "/account";
}
