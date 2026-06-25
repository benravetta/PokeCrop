import { describe, expect, it } from "vitest";
import { safeStripeCheckoutUrl } from "./safeUrl";

describe("safeStripeCheckoutUrl", () => {
  it("accepts checkout.stripe.com", () => {
    const url = "https://checkout.stripe.com/c/pay/cs_test_abc";
    expect(safeStripeCheckoutUrl(url)).toBe(url);
  });

  it("rejects arbitrary origins", () => {
    expect(safeStripeCheckoutUrl("https://evil.com/phish")).toBeNull();
  });

  it("rejects javascript URLs", () => {
    expect(safeStripeCheckoutUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects http", () => {
    expect(safeStripeCheckoutUrl("http://checkout.stripe.com/x")).toBeNull();
  });
});
