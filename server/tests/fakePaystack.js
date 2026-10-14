// Stand-in for the Paystack API in tests. Records every call.
function fakePaystack() {
  const p = {
    calls: [],
    verifyResult: null,
    failNext: null,
    reset() {
      this.calls.length = 0;
      this.verifyResult = null;
      this.failNext = null;
    },
    _call(name, args, result) {
      this.calls.push({ name, args });
      if (this.failNext === name) {
        this.failNext = null;
        const e = new Error("Paystack said no");
        e.status = 502;
        e.provider = "Paystack said no";
        throw e;
      }
      return result;
    },
    async initialize(a) { return this._call("initialize", a, { authorization_url: `https://checkout.paystack.test/${a.reference}`, access_code: "ac", reference: a.reference }); },
    async verify(ref) { if (!this.verifyResult) throw new Error("not set"); return this._call("verify", ref, this.verifyResult); },
    async refund(a) { return this._call("refund", a, { id: 777, status: "pending" }); },
    async listBanks() { return this._call("listBanks", null, [{ name: "Access Bank", code: "044" }, { name: "GTBank", code: "058" }]); },
    async resolveAccount(a) { return this._call("resolveAccount", a, { account_name: "CHIDI OKAFOR", account_number: a.accountNumber }); },
    async createRecipient(a) { return this._call("createRecipient", a, { recipient_code: "RCP_test123" }); },
    async transfer(a) { return this._call("transfer", a, { transfer_code: "TRF_test", status: "pending", reference: a.reference }); },
  };
  return p;
}
module.exports = { fakePaystack };
