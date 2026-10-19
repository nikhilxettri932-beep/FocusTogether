(() => {
  const supabaseUrl = "https://zbhgiwnzzhmqzrgoceel.supabase.co";
  const supabaseAnonKey = "sb_publishable_cdJQOHrkogGMCf8qXGU2dQ_PSb4H4Qh";

  const authScreen = document.getElementById("authScreen");
  const appShell = document.querySelector(".app-shell");
  const authTitle = document.getElementById("authTitle");
  const authSubtitle = document.getElementById("authSubtitle");
  const authStatus = document.getElementById("authStatus");
  const authForm = document.getElementById("authForm");
  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const authConfirmPassword = document.getElementById("authConfirmPassword");
  const newPassword = document.getElementById("newPassword");
  const confirmNewPassword = document.getElementById("confirmNewPassword");
  const authSubmitBtn = document.getElementById("authSubmitBtn");
  const toggleAuthModeBtn = document.getElementById("toggleAuthModeBtn");
  const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
  const confirmPasswordWrap = document.getElementById("confirmPasswordWrap");
  const logoutBtn = document.getElementById("logoutBtn");

  let supabaseClient = null;
  let isSignupMode = false;
  let isPasswordRecoveryMode = false;

  function setStatus(message, type = "") {
    authStatus.textContent = message || "";
    authStatus.className = "auth-status" + (type ? ` ${type}` : "");
  }

  function setMode(mode) {
    isSignupMode = mode === "signup";
    authTitle.textContent = isSignupMode ? "Create your account" : "Welcome back";
    authSubtitle.textContent = isSignupMode
      ? "Sign up with your email and password to get started."
      : "Login to continue with your study groups.";
    authSubmitBtn.textContent = isSignupMode ? "Create account" : "Login";
    toggleAuthModeBtn.textContent = isSignupMode ? "Already have an account? Login" : "Create account";
    confirmPasswordWrap.classList.toggle("hidden", !isSignupMode);
    authConfirmPassword.required = isSignupMode;
  }

  function showAuthScreen() {
    if (authScreen) authScreen.classList.remove("hidden");
    if (appShell) appShell.classList.add("hidden");
  }

  function showPasswordResetForm() {
    isPasswordRecoveryMode = true;
    authTitle.textContent = "Choose a new password";
    authSubtitle.textContent = "Enter and confirm your new password below.";
    authForm.classList.add("hidden");
    resetPasswordForm.classList.remove("hidden");
    setStatus("", "");
    showAuthScreen();
    newPassword.focus();
  }

  function showLoginForm() {
    isPasswordRecoveryMode = false;
    resetPasswordForm.classList.add("hidden");
    authForm.classList.remove("hidden");
    setMode("login");
  }

  function showAppScreen() {
    if (authScreen) authScreen.classList.add("hidden");
    if (appShell) appShell.classList.remove("hidden");
    if (window.focusTogetherApp?.loadGroups) {
      window.focusTogetherApp.loadGroups().catch((error) => {
        console.error("Unable to load shared study groups:", error);
        if (typeof window.showNotice === "function") {
          window.showNotice("Could not load shared groups. Check the Supabase group setup.");
        }
      });
    }
  }

  function isSupabaseConfigured() {
    return !!window.supabase &&
      !supabaseUrl.includes("YOUR_PROJECT") &&
      !supabaseAnonKey.includes("YOUR_") &&
      supabaseUrl.startsWith("https://") &&
      supabaseAnonKey.length > 20;
  }

  function getSupabaseClient() {
    if (!window.supabase) return null;
    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    }
    return supabaseClient;
  }

  window.focusTogetherSupabase = {
    getClient: getSupabaseClient,
    getCurrentUser: async () => {
      const client = getSupabaseClient();
      if (!client) return null;
      const { data, error } = await client.auth.getUser();
      if (error) return null;
      return data.user || null;
    },
    getSessionUserId: async () => {
      const user = await window.focusTogetherSupabase.getCurrentUser();
      return user ? user.id : null;
    }
  };

  async function handleAuthSubmit(event) {
    event.preventDefault();

    const client = getSupabaseClient();
    if (!client) {
      setStatus("Supabase was not loaded. Check your internet connection or script tag.", "error");
      return;
    }

    const email = authEmail.value.trim();
    const password = authPassword.value.trim();

    if (!email || !password) {
      setStatus("Email and password are required.", "error");
      return;
    }

    if (isSignupMode) {
      const confirmPassword = authConfirmPassword.value.trim();
      if (!confirmPassword) {
        setStatus("Please confirm your password.", "error");
        return;
      }
      if (password.length < 6) {
        setStatus("Password must be at least 6 characters long.", "error");
        return;
      }
      if (password !== confirmPassword) {
        setStatus("Passwords do not match.", "error");
        return;
      }

      const { error } = await client.auth.signUp({ email, password });
      if (error) {
        setStatus(error.message, "error");
        return;
      }

      setStatus("Account created successfully. Please check your email to confirm your account.", "success");
      setMode("login");
      authForm.reset();
      return;
    }

    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(error.message, "error");
      return;
    }

    setStatus("Login successful. Redirecting...", "success");
    showAppScreen();
  }

  async function handleForgotPassword() {
    const client = getSupabaseClient();
    if (!client) {
      setStatus("Supabase was not loaded. Check your internet connection or script tag.", "error");
      return;
    }

    const email = authEmail.value.trim();
    if (!email) {
      setStatus("Enter your email address to reset your password.", "error");
      authEmail.focus();
      return;
    }

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href.split("#")[0].split("?")[0]
    });

    if (error) {
      setStatus(error.message, "error");
      return;
    }

    setStatus("Password reset email sent. Check your inbox and follow the link.", "success");
    authPassword.value = "";
    authConfirmPassword.value = "";
  }

  async function handlePasswordResetSubmit(event) {
    event.preventDefault();
    const client = getSupabaseClient();
    if (!client) {
      setStatus("Supabase was not loaded. Check your internet connection or script tag.", "error");
      return;
    }

    const password = newPassword.value;
    if (password.length < 6) {
      setStatus("Password must be at least 6 characters long.", "error");
      return;
    }
    if (password !== confirmNewPassword.value) {
      setStatus("Passwords do not match.", "error");
      return;
    }

    const { error } = await client.auth.updateUser({ password });
    if (error) {
      setStatus(error.message, "error");
      return;
    }

    isPasswordRecoveryMode = false;
    showAppScreen();
    setStatus("Password updated successfully. You are now signed in.", "success");
  }

  async function initAuth() {
    if (!window.supabase) {
      setStatus("Supabase script could not be loaded. Please check the CDN URL.", "error");
      return;
    }

    if (!isSupabaseConfigured()) {
      setStatus("Add your Supabase project URL and anon key in auth.js before running the app.", "error");
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setStatus("Unable to initialize Supabase client.", "error");
      return;
    }

    client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        showPasswordResetForm();
      }

      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && !isPasswordRecoveryMode) {
        showAppScreen();
        setStatus("", "");
      }

      if (event === "SIGNED_OUT") {
        authForm.reset();
        resetPasswordForm.reset();
        showLoginForm();
        showAuthScreen();
        setStatus("You have been signed out.", "success");
      }
    });

    const { data: { session } } = await client.auth.getSession();
    if (session && !isPasswordRecoveryMode) {
      showAppScreen();
      return;
    }

    showAuthScreen();
  }

  if (authForm) {
    authForm.addEventListener("submit", handleAuthSubmit);
  }

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", handlePasswordResetSubmit);
  }

  if (toggleAuthModeBtn) {
    toggleAuthModeBtn.addEventListener("click", () => {
      setMode(isSignupMode ? "login" : "signup");
      setStatus("", "");
      authForm.reset();
    });
  }

  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener("click", handleForgotPassword);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      const client = getSupabaseClient();
      if (!client) {
        return;
      }
      await client.auth.signOut();
    });
  }

  setMode("login");
  initAuth();
})();
