import { useState } from "react";

import { Link, useNavigate, useSearchParams } from "react-router-dom";

import axios from "axios";

import { Mail, Lock, Lock as LockIcon } from "lucide-react";

import { AuthLayout } from "@/components/auth/AuthLayout";

import { IconField } from "@/components/auth/IconField";

import { Button } from "@/components/ui/button";

import { useAuth } from "@/context/AuthContext";

import { ROLES } from "@/lib/roles";



export default function LoginPage() {

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const sessionExpired = searchParams.get("session") === "expired";

  const { signInWithCredentials } = useAuth();

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");

  const [username, setUsername] = useState("");

  const [password, setPassword] = useState("");



  async function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    setSubmitting(true);

    setError("");

    try {

      const role = await signInWithCredentials(username, password);

      navigate(ROLES[role].landing);

    } catch (err) {

      if (axios.isAxiosError(err) && !err.response) {

        setError(

          "Cannot reach the server. Start the backend first: cd backend → .\\venv\\Scripts\\python.exe manage.py runserver"

        );

      } else if (axios.isAxiosError(err) && err.response?.status === 401) {

        setError("Wrong username or password.");

      } else {

        setError("Sign in failed. Make sure the backend is running on port 8000.");

      }

    } finally {

      setSubmitting(false);

    }

  }



  return (

    <AuthLayout>

      <div className="mb-6 flex items-start justify-between">

        <div>

          <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>

          <p className="mt-1 text-sm text-slate-500">Sign in to NeoGuardian clinical decision support</p>

        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50">

          <LockIcon className="h-4 w-4 text-primary" />

        </div>

      </div>



      {sessionExpired && (

        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">

          Your session expired. Sign in again to continue.

        </p>

      )}



      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}



      <form onSubmit={handleSubmit} className="space-y-4">

        <IconField

          id="identifier"

          label="Username"

          icon={Mail}

          type="text"

          placeholder="Your username"

          autoComplete="username"

          value={username}

          onChange={(e) => setUsername(e.target.value)}

          required

        />

        <IconField

          id="password"

          label="Password"

          icon={Lock}

          isPassword

          placeholder="Your password"

          autoComplete="current-password"

          value={password}

          onChange={(e) => setPassword(e.target.value)}

          required

        />



        <div className="flex items-center justify-between">

          <label className="flex items-center gap-2 text-sm text-slate-500">

            <input type="checkbox" className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30" />

            Remember me

          </label>

          <Link to="/login" className="text-sm font-medium text-primary hover:text-teal-700">

            Forgot password?

          </Link>

        </div>



        <Button type="submit" disabled={submitting} className="h-11 w-full rounded-xl text-sm">

          {submitting ? "Signing in..." : "Sign In"}

        </Button>

      </form>



      <p className="mt-6 text-center text-sm text-slate-500">

        Need an account? Ask your hospital <strong>admin</strong> to create one for you.

      </p>

    </AuthLayout>

  );

}

