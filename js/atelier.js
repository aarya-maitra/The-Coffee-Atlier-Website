(function () {
  const USERS_KEY = "atelierUsers";
  const CURRENT_USER_KEY = "atelierCurrentUser";
  const CART_KEY = "cartItems";
  const CART_PREFIX = "atelierCart_";
  const DISCOUNT_RATE_KEY = "discountRate";
  const DISCOUNT_CODE_KEY = "discountCode";
  const CHECKOUT_DRAFT_KEY = "pendingCheckout";
  const FIRST_ORDER_PREFIX = "atelierFirstOrderUsed_";
  const AUTH_MODAL_ID = "authPromptModal";
  const MOBILE_NAV_BREAKPOINT = 760;

  function readJson(storage, key, fallback) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(storage, key, value) {
    storage.setItem(key, JSON.stringify(value));
  }

  function getUserKey(user) {
    if (!user) return "";
    return String(user.username || user.email || "").trim().toLowerCase();
  }

  function getCartKeyForUser(user) {
    const key = getUserKey(user);
    return key ? `${CART_PREFIX}${key}` : "";
  }

  function migrateArrayUsers() {
    const localUsers = readJson(localStorage, USERS_KEY, null);
    if (Array.isArray(localUsers)) return localUsers;

    const legacyUsers = readJson(sessionStorage, USERS_KEY, []);
    if (Array.isArray(legacyUsers) && legacyUsers.length) {
      writeJson(localStorage, USERS_KEY, legacyUsers);
      return legacyUsers;
    }

    writeJson(localStorage, USERS_KEY, []);
    return [];
  }

  function migrateCurrentUser() {
    const localUser = readJson(localStorage, CURRENT_USER_KEY, null);
    if (localUser && typeof localUser === "object") return localUser;

    const legacyUser = readJson(sessionStorage, CURRENT_USER_KEY, null);
    if (legacyUser && typeof legacyUser === "object") {
      writeJson(localStorage, CURRENT_USER_KEY, legacyUser);
      return legacyUser;
    }

    return null;
  }

  function getUsers() {
    return migrateArrayUsers();
  }

  function saveUsers(users) {
    writeJson(localStorage, USERS_KEY, users);
    writeJson(sessionStorage, USERS_KEY, users);
  }

  function getCurrentUser() {
    return migrateCurrentUser();
  }

  function getCart() {
    const user = getCurrentUser();
    if (user) {
      const sessionCart = readJson(sessionStorage, CART_KEY, null);
      if (Array.isArray(sessionCart)) return sessionCart;
      const storedCart = readJson(localStorage, getCartKeyForUser(user), []);
      writeJson(sessionStorage, CART_KEY, storedCart);
      return storedCart;
    }
    return readJson(sessionStorage, CART_KEY, []);
  }

  function saveCart(cart) {
    writeJson(sessionStorage, CART_KEY, cart);
    const user = getCurrentUser();
    if (user) {
      writeJson(localStorage, getCartKeyForUser(user), cart);
    }
    updateCartBadges();
  }

  function clearCart() {
    const user = getCurrentUser();
    if (user) {
      localStorage.removeItem(getCartKeyForUser(user));
    }
    sessionStorage.removeItem(CART_KEY);
    updateCartBadges();
  }

  function setCurrentUser(user) {
    writeJson(localStorage, CURRENT_USER_KEY, user);
    writeJson(sessionStorage, CURRENT_USER_KEY, user);
    const storedCart = user ? readJson(localStorage, getCartKeyForUser(user), []) : [];
    writeJson(sessionStorage, CART_KEY, storedCart);
    updateCurrentUserLinks();
    updateNavAuthControls();
    updateCartBadges();
  }

  function clearCurrentUser() {
    const currentUser = getCurrentUser();
    if (currentUser) {
      writeJson(localStorage, getCartKeyForUser(currentUser), readJson(sessionStorage, CART_KEY, []));
    }
    localStorage.removeItem(CURRENT_USER_KEY);
    sessionStorage.removeItem(CURRENT_USER_KEY);
    sessionStorage.removeItem(CART_KEY);
    sessionStorage.removeItem(DISCOUNT_RATE_KEY);
    sessionStorage.removeItem(DISCOUNT_CODE_KEY);
    sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
    updateCurrentUserLinks();
    updateNavAuthControls();
    updateCartBadges();
  }

  function isLoggedIn() {
    return Boolean(getCurrentUser());
  }

  function getFirstOrderKey(user) {
    return `${FIRST_ORDER_PREFIX}${getUserKey(user)}`;
  }

  function hasUsedFirstOrder(user) {
    if (!user) return false;
    return localStorage.getItem(getFirstOrderKey(user)) === "1";
  }

  function markFirstOrderUsed(user) {
    if (!user) return;
    localStorage.setItem(getFirstOrderKey(user), "1");
  }

  function getDiscountRate() {
    return Number(sessionStorage.getItem(DISCOUNT_RATE_KEY) || 0);
  }

  function setDiscount(rate, code) {
    sessionStorage.setItem(DISCOUNT_RATE_KEY, String(rate));
    if (code) {
      sessionStorage.setItem(DISCOUNT_CODE_KEY, code);
    } else {
      sessionStorage.removeItem(DISCOUNT_CODE_KEY);
    }
  }

  function clearDiscount() {
    sessionStorage.removeItem(DISCOUNT_RATE_KEY);
    sessionStorage.removeItem(DISCOUNT_CODE_KEY);
  }

  function clearCheckoutDraft() {
    sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
  }

  function getCheckoutDraft() {
    return readJson(sessionStorage, CHECKOUT_DRAFT_KEY, null);
  }

  function setCheckoutDraft(draft) {
    writeJson(sessionStorage, CHECKOUT_DRAFT_KEY, draft);
  }

  function updateCartBadges() {
    const count = getCart().reduce((sum, item) => sum + Number(item.qty || 0), 0);
    document.querySelectorAll(".cart-badge").forEach((badge) => {
      badge.textContent = String(count);
    });
  }

  function ensureAuthModal() {
    let modal = document.getElementById(AUTH_MODAL_ID);
    if (modal) return modal;

    modal = document.createElement("div");
    modal.className = "modal-backdrop auth-modal-backdrop";
    modal.id = AUTH_MODAL_ID;
    modal.innerHTML = `
      <div class="modal auth-modal">
        <div class="modal-header">
          <h3 class="modal-title">Continue with account</h3>
          <button class="close-btn" type="button" data-auth-close>&times;</button>
        </div>
        <div class="modal-body auth-modal-body">
          <div class="auth-modal-copy">
            <p class="auth-modal-message">Please sign in or create an account to continue.</p>
            <p class="auth-modal-note">First orders get 10% off with code FIRSTORDER.</p>
          </div>
          <div class="auth-modal-actions">
            <a class="btn btn-primary" data-auth-signup href="signup.html">Sign up</a>
            <a class="btn btn-secondary" data-auth-login href="login.html">Log in</a>
          </div>
        </div>
      </div>
    `;

    const mountTarget = document.body || document.documentElement;
    mountTarget.appendChild(modal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.matches("[data-auth-close]")) {
        modal.classList.remove("show");
      }
    });

    return modal;
  }

  function getReturnPath() {
    const path = `${window.location.pathname.split("/").pop() || "index.html"}${window.location.search || ""}`;
    return encodeURIComponent(path);
  }

  function updateAuthLinks() {
    const modal = document.getElementById(AUTH_MODAL_ID);
    if (!modal) return;
    const returnTo = getReturnPath();
    const signupLink = modal.querySelector("[data-auth-signup]");
    const loginLink = modal.querySelector("[data-auth-login]");
    if (signupLink) signupLink.href = `signup.html?redirect=${returnTo}`;
    if (loginLink) loginLink.href = `login.html?redirect=${returnTo}`;
  }

  function showAuthPrompt(message) {
    const modal = ensureAuthModal();
    const prompt = modal.querySelector(".auth-modal-message");
    if (prompt) {
      prompt.textContent = message || "Please sign in or create an account to continue.";
    }
    updateAuthLinks();
    modal.classList.add("show");
  }

  function requireLogin(message) {
    if (isLoggedIn()) return true;
    showAuthPrompt(message);
    return false;
  }

  function applyFirstOrderDiscount() {
    const user = getCurrentUser();
    if (!user) {
      showAuthPrompt("Please sign in or create an account to continue.");
      return false;
    }
    if (hasUsedFirstOrder(user)) {
      alert("FIRSTORDER is only available on your first order.");
      return false;
    }
    setDiscount(0.1, "FIRSTORDER");
    alert("Offer applied: 10% discount on your first order.");
    return true;
  }

  function updateCurrentUserLinks() {
    document.querySelectorAll("[data-current-user]").forEach((node) => {
      const user = getCurrentUser();
      node.textContent = user ? `Logged in as ${user.firstName || user.username}` : "";
      node.hidden = !user;
    });
  }

  function updateNavAuthControls() {
    const user = getCurrentUser();
    document.querySelectorAll('.site-nav a[href="signup.html"]').forEach((link) => {
      link.hidden = Boolean(user);
    });
    document.querySelectorAll('.site-nav a[href="login.html"], .site-nav a[href="#logout"]').forEach((link) => {
      if (user) {
        link.textContent = "Logout";
        link.href = "#logout";
        link.dataset.logoutLink = "true";
      } else {
        link.textContent = "Login";
        link.href = "login.html";
        delete link.dataset.logoutLink;
      }
    });
  }

  function closeDropdown(dropdown) {
    if (!dropdown) return;
    const toggle = dropdown.querySelector(".nav-dropdown-toggle");
    dropdown.classList.remove("open");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    }
  }

  function closeMobileNav(navWrap) {
    if (!navWrap) return;
    const toggle = navWrap.querySelector(".nav-toggle");
    navWrap.classList.remove("menu-open");
    navWrap.querySelectorAll(".nav-dropdown").forEach(closeDropdown);
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    }
  }

  function upgradeNavDropdownToggles() {
    document.querySelectorAll(".nav-dropdown-toggle").forEach((toggle) => {
      if (toggle.tagName === "BUTTON") return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = toggle.className;
      button.textContent = toggle.textContent || "";
      button.setAttribute("aria-haspopup", "true");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", `${button.textContent.trim() || "Menu"} submenu`);
      toggle.replaceWith(button);
    });
  }

  function setupDropdownInteractions() {
    document.querySelectorAll(".nav-dropdown").forEach((dropdown) => {
      const toggle = dropdown.querySelector(".nav-dropdown-toggle");
      if (!toggle || toggle.dataset.dropdownBound === "true") return;
      toggle.dataset.dropdownBound = "true";
      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        const isOpen = dropdown.classList.contains("open");
        document.querySelectorAll(".nav-dropdown.open").forEach((openDropdown) => {
          if (openDropdown !== dropdown) closeDropdown(openDropdown);
        });
        dropdown.classList.toggle("open", !isOpen);
        toggle.setAttribute("aria-expanded", String(!isOpen));
      });
    });
  }

  function setupMobileNavigation() {
    document.querySelectorAll(".nav-wrap").forEach((navWrap) => {
      const siteNav = navWrap.querySelector(".site-nav");
      if (!siteNav) return;

      if (!siteNav.id) {
        siteNav.id = `site-nav-${Math.random().toString(36).slice(2, 9)}`;
      }

      let toggle = navWrap.querySelector(".nav-toggle");
      if (!toggle) {
        toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "nav-toggle";
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-controls", siteNav.id);
        toggle.innerHTML = '<span class="nav-toggle-icon" aria-hidden="true"></span><span class="nav-toggle-text">Menu</span>';
        navWrap.insertBefore(toggle, siteNav);
      }

      if (!toggle.dataset.navBound) {
        toggle.dataset.navBound = "true";
        toggle.addEventListener("click", (event) => {
          event.preventDefault();
          const isOpen = navWrap.classList.contains("menu-open");
          if (isOpen) {
            closeMobileNav(navWrap);
            return;
          }
          document.querySelectorAll(".nav-wrap.menu-open").forEach((openNavWrap) => {
            if (openNavWrap !== navWrap) closeMobileNav(openNavWrap);
          });
          navWrap.classList.add("menu-open");
          toggle.setAttribute("aria-expanded", "true");
        });
      }

      siteNav.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
          closeMobileNav(navWrap);
        }
      });
    });

    document.addEventListener("click", (event) => {
      const navWrap = event.target.closest(".nav-wrap");
      if (!navWrap) {
        document.querySelectorAll(".nav-wrap.menu-open").forEach(closeMobileNav);
      }
      if (!event.target.closest(".nav-dropdown")) {
        document.querySelectorAll(".nav-dropdown.open").forEach(closeDropdown);
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > MOBILE_NAV_BREAKPOINT) {
        document.querySelectorAll(".nav-wrap.menu-open").forEach(closeMobileNav);
      }
    });
  }

  function handleNavClicks(event) {
    const logoutLink = event.target.closest('[data-logout-link="true"]');
    if (!logoutLink) return;
    event.preventDefault();
    clearCurrentUser();
    window.location.href = "index.html";
  }

  function bootstrap() {
    const user = getCurrentUser();
    if (user) {
      const storedCart = readJson(localStorage, getCartKeyForUser(user), []);
      writeJson(sessionStorage, CART_KEY, storedCart);
    }
    updateCartBadges();
    updateCurrentUserLinks();
    updateNavAuthControls();
    upgradeNavDropdownToggles();
    setupDropdownInteractions();
    setupMobileNavigation();
  }

  document.addEventListener("click", handleNavClicks);

  window.Atelier = {
    getUsers,
    saveUsers,
    getCurrentUser,
    setCurrentUser,
    clearCurrentUser,
    isLoggedIn,
    getUserKey,
    getCart,
    saveCart,
    clearCart,
    getDiscountRate,
    setDiscount,
    clearDiscount,
    clearCheckoutDraft,
    getCheckoutDraft,
    setCheckoutDraft,
    updateCartBadges,
    showAuthPrompt,
    requireLogin,
    applyFirstOrderDiscount,
    hasUsedFirstOrder,
    markFirstOrderUsed
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
