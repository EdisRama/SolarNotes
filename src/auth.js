import { createClient } from "@supabase/supabase-js";

const DATA_KEYS = [
  "solar-notes:v1",
  "solar-notes:categories:v1",
  "solar-notes:tasks:v1",
  "solar-notes:calendar-events:v1",
  "solar-notes:folders:v1"
];
let supabase;

function showAuthError(message) {
  const error = document.querySelector("#auth-error");
  error.textContent = message;
  error.hidden = false;
}

function getClient() {
  if (supabase) return supabase;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !publicKey) {
    throw new Error("Cloud-inloggningen är inte konfigurerad. Följ installationsstegen i README.");
  }
  supabase = createClient(url, publicKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true
    }
  });
  return supabase;
}

export async function authenticate() {
  const screen = document.querySelector("#auth-screen");
  const appShell = document.querySelector("#app-shell");
  const form = document.querySelector("#auth-form");
  const emailInput = document.querySelector("#auth-email");
  const passwordInput = document.querySelector("#auth-password");
  const submitButton = document.querySelector("#auth-submit");
  const errorLabel = document.querySelector("#auth-error");

  screen.hidden = false;
  appShell.hidden = true;
  try {
    const client = getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session) {
      screen.hidden = true;
      appShell.hidden = false;
      return data.session;
    }
  } catch (error) {
    showAuthError(error.message || "Kunde inte ansluta till inloggningen.");
    throw error;
  }

  return new Promise((resolve) => {
    let startupContinued = false;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorLabel.hidden = true;
      submitButton.disabled = true;
      try {
        const client = getClient();
        const { data, error } = await client.auth.signInWithPassword({
          email: emailInput.value.trim(),
          password: passwordInput.value
        });
        if (error) throw error;
        if (!data.session) throw new Error("Inloggningen skapade ingen session.");
        passwordInput.value = "";
        screen.hidden = true;
        appShell.hidden = false;
        if (startupContinued) {
          window.location.reload();
        } else {
          startupContinued = true;
          resolve(data.session);
        }
      } catch (error) {
        showAuthError(error.message || "Kunde inte logga in.");
        passwordInput.focus();
        passwordInput.select();
      } finally {
        submitButton.disabled = false;
      }
    });
  });
}

export async function loadCloudData(session) {
  const client = getClient();
  const { data, error } = await client
    .from("solar_notes_data")
    .select("data")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error) throw new Error(`Kunde inte läsa molndata: ${error.message}`, { cause: error });
  return data ? data.data : null;
}

export async function saveCloudData(data) {
  const client = getClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw new Error(`Kunde inte verifiera sessionen: ${sessionError.message}`, { cause: sessionError });
  if (!sessionData.session) throw new Error("Sessionen har upphört. Logga in igen.");

  const { error } = await client.from("solar_notes_data").upsert(
    {
      user_id: sessionData.session.user.id,
      data,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`Kunde inte spara till molnet: ${error.message}`, { cause: error });
}

export async function logout() {
  const client = getClient();
  const { error } = await client.auth.signOut();
  if (error) throw new Error(`Kunde inte logga ut: ${error.message}`, { cause: error });
  for (const key of DATA_KEYS) localStorage.removeItem(key);
  window.location.reload();
}

export function showAuthErrorMessage(message) {
  document.querySelector("#app-shell").hidden = true;
  document.querySelector("#auth-screen").hidden = false;
  showAuthError(message);
}
