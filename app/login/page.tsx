"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { login } from "@/services/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const token = await login(email, password);
      window.localStorage.setItem("easy_customs_token", token.access_token);
      router.push("/dashboard");
    } catch {
      setError("Login failed. Check credentials and API availability.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-6">
      <section className="w-full max-w-md rounded-md border border-line bg-white p-8">
        <ShieldCheck className="text-teal" size={36} />
        <h1 className="mt-4 text-2xl font-black">EASY CUSTOMS XML GENERATOR</h1>
        <p className="mt-2 text-sm text-muted">Secure operator access for Nepal Customs ASYCUDA XML generation.</p>
        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <input className="focus-ring min-h-11 rounded-md border border-line px-3" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input className="focus-ring min-h-11 rounded-md border border-line px-3" placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
          <button className="focus-ring min-h-11 rounded-md bg-teal px-4 font-bold text-white" type="submit">Login</button>
        </form>
      </section>
    </main>
  );
}
