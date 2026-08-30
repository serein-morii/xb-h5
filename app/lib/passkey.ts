const fromBase64Url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), (char) => char.charCodeAt(0));
const toBase64Url = (value: ArrayBuffer | null) => value ? btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : null;

export async function createPasskey(raw: Record<string, unknown>) {
  if (!window.PublicKeyCredential || !navigator.credentials) throw new Error("当前浏览器不支持 Passkey");
  const source = raw as { challenge: string; user: { id: string }; excludeCredentials?: Array<{ id: string }> };
  const publicKey = { ...raw, challenge: fromBase64Url(source.challenge), user: { ...(raw.user as object), id: fromBase64Url(source.user.id) }, excludeCredentials: source.excludeCredentials?.map((item) => ({ ...item, id: fromBase64Url(item.id) })) } as unknown as PublicKeyCredentialCreationOptions;
  const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential | null;
  if (!credential) throw new Error("Passkey 创建已取消");
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id, rawId: toBase64Url(credential.rawId), type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: { attestationObject: toBase64Url(response.attestationObject), clientDataJSON: toBase64Url(response.clientDataJSON), transports: response.getTransports?.() || [] },
  };
}

export async function getPasskey(raw: Record<string, unknown>) {
  if (!window.PublicKeyCredential || !navigator.credentials) throw new Error("当前浏览器不支持 Passkey");
  const source = raw as { challenge: string; allowCredentials?: Array<{ id: string }> };
  const publicKey = { ...raw, challenge: fromBase64Url(source.challenge), allowCredentials: source.allowCredentials?.map((item) => ({ ...item, id: fromBase64Url(item.id) })) } as PublicKeyCredentialRequestOptions;
  const credential = await navigator.credentials.get({ publicKey }) as PublicKeyCredential | null;
  if (!credential) throw new Error("Passkey 验证已取消");
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id, rawId: toBase64Url(credential.rawId), type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: { authenticatorData: toBase64Url(response.authenticatorData), clientDataJSON: toBase64Url(response.clientDataJSON), signature: toBase64Url(response.signature), userHandle: toBase64Url(response.userHandle) },
  };
}
