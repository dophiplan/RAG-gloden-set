"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/lib/api-utils";
import { SUPPORTED_LANGUAGES } from "@/types";

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  roles?: string[];
}

export interface SettingItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  display_order: number;
}

export interface SettingsState {
  // User
  user: UserProfile | null;
  loading: boolean;
  isAuthorized: boolean | null;
  isRsupportUser: boolean;
  isAdmin: boolean;
  
  // Products
  products: SettingItem[];
  loadingProducts: boolean;
  
  // Languages
  languages: SettingItem[];
  loadingLanguages: boolean;
  
  // Platforms
  platforms: SettingItem[];
  loadingPlatforms: boolean;
}

export function useSettings() {
  const [state, setState] = useState<SettingsState>({
    user: null,
    loading: true,
    isAuthorized: null,
    isRsupportUser: false,
    isAdmin: false,
    products: [],
    loadingProducts: true,
    languages: [],
    loadingLanguages: true,
    platforms: [],
    loadingPlatforms: true,
  });

  // Fetch user
  useEffect(() => {
    async function fetchUser() {
      try {
        const data = await apiGet<{
          user: UserProfile & { roles?: string[]; account_level?: string };
        }>("/api/auth/me");

        if (data.user) {
          const roles = data.user.roles || [];
          const level = data.user.account_level || "";
          const isMasterUser = level === "master" || level === "1st_master";

          const email = data.user.email || "";
          const isRsupport = email.endsWith("@rsupport.com");
          const hasAdminRole = roles.includes("admin") || roles.includes("owner");

          setState(prev => ({
            ...prev,
            user: {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name || null,
              roles,
            },
            isAuthorized: isMasterUser,
            isRsupportUser: isRsupport,
            isAdmin: hasAdminRole,
          }));
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setState(prev => ({ ...prev, loading: false }));
      }
    }

    fetchUser();
  }, []);

  // Fetch products
  useEffect(() => {
    async function fetchProducts() {
      try {
        const data = await apiGet<{ products: SettingItem[] }>("/api/products");
        setState(prev => ({ ...prev, products: data.products || [] }));
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setState(prev => ({ ...prev, loadingProducts: false }));
      }
    }

    fetchProducts();
  }, []);

  // Fetch languages
  useEffect(() => {
    async function fetchLanguages() {
      try {
        const data = await apiGet<{ languages: SettingItem[] }>("/api/languages");
        if (data.languages?.length > 0) {
          setState(prev => ({ ...prev, languages: data.languages }));
        } else {
          // Fallback
          const fallback = Object.entries(SUPPORTED_LANGUAGES).map(
            ([code, name], index) => ({
              id: code,
              code,
              name,
              description: null,
              display_order: index + 1,
            })
          );
          setState(prev => ({ ...prev, languages: fallback }));
        }
      } catch (error) {
        console.error("Error fetching languages:", error);
        const fallback = Object.entries(SUPPORTED_LANGUAGES).map(
          ([code, name], index) => ({
            id: code,
            code,
            name,
            description: null,
            display_order: index + 1,
          })
        );
        setState(prev => ({ ...prev, languages: fallback }));
      } finally {
        setState(prev => ({ ...prev, loadingLanguages: false }));
      }
    }

    fetchLanguages();
  }, []);

  // Fetch platforms
  useEffect(() => {
    async function fetchPlatforms() {
      try {
        const data = await apiGet<{ platforms: SettingItem[] }>("/api/platforms");
        setState(prev => ({ ...prev, platforms: data.platforms || [] }));
      } catch (error) {
        console.error("Error fetching platforms:", error);
      } finally {
        setState(prev => ({ ...prev, loadingPlatforms: false }));
      }
    }

    fetchPlatforms();
  }, []);

  // Refresh functions
  const refreshProducts = useCallback(async () => {
    setState(prev => ({ ...prev, loadingProducts: true }));
    try {
      const data = await apiGet<{ products: SettingItem[] }>("/api/products");
      setState(prev => ({ ...prev, products: data.products || [] }));
    } catch (error) {
      console.error("Error refreshing products:", error);
    } finally {
      setState(prev => ({ ...prev, loadingProducts: false }));
    }
  }, []);

  const refreshLanguages = useCallback(async () => {
    setState(prev => ({ ...prev, loadingLanguages: true }));
    try {
      const data = await apiGet<{ languages: SettingItem[] }>("/api/languages");
      setState(prev => ({ ...prev, languages: data.languages || [] }));
    } catch (error) {
      console.error("Error refreshing languages:", error);
    } finally {
      setState(prev => ({ ...prev, loadingLanguages: false }));
    }
  }, []);

  const refreshPlatforms = useCallback(async () => {
    setState(prev => ({ ...prev, loadingPlatforms: true }));
    try {
      const data = await apiGet<{ platforms: SettingItem[] }>("/api/platforms");
      setState(prev => ({ ...prev, platforms: data.platforms || [] }));
    } catch (error) {
      console.error("Error refreshing platforms:", error);
    } finally {
      setState(prev => ({ ...prev, loadingPlatforms: false }));
    }
  }, []);

  return {
    ...state,
    refreshProducts,
    refreshLanguages,
    refreshPlatforms,
  };
}
