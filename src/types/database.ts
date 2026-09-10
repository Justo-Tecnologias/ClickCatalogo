export type Json =
  | boolean
  | null
  | number
  | string
  | { [key: string]: Json | undefined }
  | Json[];

export type TenantTheme =
  | "classico"
  | "natural"
  | "tech"
  | "delivery"
  | "elegante"
  | "minimal";

export type TenantStatus = "ativo" | "inadimplente" | "cancelado";
export type SubscriptionStatus = "ativo" | "atrasado" | "cancelado";
export type SignupIntentStatus = "pendente" | "pago" | "expirado" | "cancelado";
export type AccountDeletionSource = "titular" | "retencao";
export type AccountDeletionStatus = "agendado" | "processando" | "concluido" | "cancelado" | "falhou";

export type Database = {
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          key_hash: string;
          request_count: number;
          reset_at: string;
          updated_at: string;
        };
        Insert: {
          key_hash: string;
          request_count?: number;
          reset_at: string;
          updated_at?: string;
        };
        Update: {
          key_hash?: string;
          request_count?: number;
          reset_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      account_deletion_requests: {
        Row: {
          attempts: number;
          canceled_at: string | null;
          completed_at: string | null;
          created_at: string;
          expedited_at: string | null;
          expedited_withdrawn_at: string | null;
          id: string;
          last_error: string | null;
          owner_user_id: string;
          processing_started_at: string | null;
          requested_at: string;
          scheduled_for: string;
          source: AccountDeletionSource;
          status: AccountDeletionStatus;
          tenant_id: string | null;
          tenant_id_original: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          canceled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          expedited_at?: string | null;
          expedited_withdrawn_at?: string | null;
          id?: string;
          last_error?: string | null;
          owner_user_id: string;
          processing_started_at?: string | null;
          requested_at?: string;
          scheduled_for: string;
          source?: AccountDeletionSource;
          status?: AccountDeletionStatus;
          tenant_id?: string | null;
          tenant_id_original: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          canceled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          expedited_at?: string | null;
          expedited_withdrawn_at?: string | null;
          id?: string;
          last_error?: string | null;
          owner_user_id?: string;
          processing_started_at?: string | null;
          requested_at?: string;
          scheduled_for?: string;
          source?: AccountDeletionSource;
          status?: AccountDeletionStatus;
          tenant_id?: string | null;
          tenant_id_original?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      asaas_webhook_events: {
        Row: {
          attempts: number;
          event_id: string;
          event_type: string;
          payload: Json;
          processed_at: string | null;
          processing_error: string | null;
          processing_started_at: string;
          received_at: string;
        };
        Insert: {
          attempts?: number;
          event_id: string;
          event_type: string;
          payload: Json;
          processed_at?: string | null;
          processing_error?: string | null;
          processing_started_at?: string;
          received_at?: string;
        };
        Update: {
          attempts?: number;
          event_id?: string;
          event_type?: string;
          payload?: Json;
          processed_at?: string | null;
          processing_error?: string | null;
          processing_started_at?: string;
          received_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string;
          id: string;
          nome: string;
          ordem: number;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nome: string;
          ordem?: number;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      legal_retention_records: {
        Row: {
          archived_at: string;
          asaas_customer_id: string | null;
          asaas_subscription_id: string | null;
          id: string;
          owner_user_id: string;
          privacy_accepted_at: string | null;
          privacy_version: string | null;
          retain_until: string;
          service_canceled_at: string;
          service_started_at: string;
          signup_external_reference: string | null;
          subscription_status: SubscriptionStatus | null;
          subscription_value: number | null;
          tenant_id_original: string;
          terms_accepted_at: string | null;
          terms_version: string | null;
        };
        Insert: {
          archived_at?: string;
          asaas_customer_id?: string | null;
          asaas_subscription_id?: string | null;
          id?: string;
          owner_user_id: string;
          privacy_accepted_at?: string | null;
          privacy_version?: string | null;
          retain_until: string;
          service_canceled_at: string;
          service_started_at: string;
          signup_external_reference?: string | null;
          subscription_status?: SubscriptionStatus | null;
          subscription_value?: number | null;
          tenant_id_original: string;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
        };
        Update: {
          archived_at?: string;
          asaas_customer_id?: string | null;
          asaas_subscription_id?: string | null;
          id?: string;
          owner_user_id?: string;
          privacy_accepted_at?: string | null;
          privacy_version?: string | null;
          retain_until?: string;
          service_canceled_at?: string;
          service_started_at?: string;
          signup_external_reference?: string | null;
          subscription_status?: SubscriptionStatus | null;
          subscription_value?: number | null;
          tenant_id_original?: string;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          ativo: boolean;
          category_id: string;
          created_at: string;
          descricao: string | null;
          id: string;
          imagem_url: string | null;
          nome: string;
          ordem: number;
          preco: number;
          tenant_id: string;
          updated_at: string;
          variacao_info: string | null;
        };
        Insert: {
          ativo?: boolean;
          category_id: string;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          imagem_url?: string | null;
          nome: string;
          ordem?: number;
          preco: number;
          tenant_id: string;
          updated_at?: string;
          variacao_info?: string | null;
        };
        Update: {
          ativo?: boolean;
          category_id?: string;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          imagem_url?: string | null;
          nome?: string;
          ordem?: number;
          preco?: number;
          tenant_id?: string;
          updated_at?: string;
          variacao_info?: string | null;
        };
        Relationships: [];
      };
      signup_intents: {
        Row: {
          asaas_checkout_id: string | null;
          asaas_customer_id: string | null;
          asaas_subscription_id: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          external_reference: string;
          id: string;
          nome_loja: string;
          privacy_accepted_at: string;
          privacy_version: string;
          provisioned_tenant_id: string | null;
          slug: string;
          status: SignupIntentStatus;
          tema: TenantTheme;
          terms_accepted_at: string;
          terms_version: string;
          updated_at: string;
          whatsapp: string;
        };
        Insert: {
          asaas_checkout_id?: string | null;
          asaas_customer_id?: string | null;
          asaas_subscription_id?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          external_reference?: string;
          id?: string;
          nome_loja: string;
          privacy_accepted_at: string;
          privacy_version?: string;
          provisioned_tenant_id?: string | null;
          slug: string;
          status?: SignupIntentStatus;
          tema?: TenantTheme;
          terms_accepted_at: string;
          terms_version?: string;
          updated_at?: string;
          whatsapp: string;
        };
        Update: {
          asaas_checkout_id?: string | null;
          asaas_customer_id?: string | null;
          asaas_subscription_id?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          external_reference?: string;
          id?: string;
          nome_loja?: string;
          privacy_accepted_at?: string;
          privacy_version?: string;
          provisioned_tenant_id?: string | null;
          slug?: string;
          status?: SignupIntentStatus;
          tema?: TenantTheme;
          terms_accepted_at?: string;
          terms_version?: string;
          updated_at?: string;
          whatsapp?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          access_until: string | null;
          asaas_customer_id: string | null;
          asaas_subscription_id: string | null;
          cancel_at_period_end: boolean;
          cancellation_requested_at: string | null;
          created_at: string;
          id: string;
          next_due_date: string | null;
          portal_url: string | null;
          status: SubscriptionStatus;
          tenant_id: string;
          updated_at: string;
          valor: number;
        };
        Insert: {
          access_until?: string | null;
          asaas_customer_id?: string | null;
          asaas_subscription_id?: string | null;
          cancel_at_period_end?: boolean;
          cancellation_requested_at?: string | null;
          created_at?: string;
          id?: string;
          next_due_date?: string | null;
          portal_url?: string | null;
          status?: SubscriptionStatus;
          tenant_id: string;
          updated_at?: string;
          valor?: number;
        };
        Update: {
          access_until?: string | null;
          asaas_customer_id?: string | null;
          asaas_subscription_id?: string | null;
          cancel_at_period_end?: boolean;
          cancellation_requested_at?: string | null;
          created_at?: string;
          id?: string;
          next_due_date?: string | null;
          portal_url?: string | null;
          status?: SubscriptionStatus;
          tenant_id?: string;
          updated_at?: string;
          valor?: number;
        };
        Relationships: [];
      };
      tenants: {
        Row: {
          banner_url: string | null;
          canceled_at: string | null;
          created_at: string;
          descricao_curta: string | null;
          endereco: string | null;
          id: string;
          instagram: string | null;
          logo_url: string | null;
          nome_loja: string;
          owner_user_id: string;
          slug: string;
          status: TenantStatus;
          tema: TenantTheme;
          updated_at: string;
          whatsapp: string;
        };
        Insert: {
          banner_url?: string | null;
          canceled_at?: string | null;
          created_at?: string;
          descricao_curta?: string | null;
          endereco?: string | null;
          id?: string;
          instagram?: string | null;
          logo_url?: string | null;
          nome_loja: string;
          owner_user_id: string;
          slug: string;
          status?: TenantStatus;
          tema?: TenantTheme;
          updated_at?: string;
          whatsapp: string;
        };
        Update: {
          banner_url?: string | null;
          canceled_at?: string | null;
          created_at?: string;
          descricao_curta?: string | null;
          endereco?: string | null;
          id?: string;
          instagram?: string | null;
          logo_url?: string | null;
          nome_loja?: string;
          owner_user_id?: string;
          slug?: string;
          status?: TenantStatus;
          tema?: TenantTheme;
          updated_at?: string;
          whatsapp?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      archive_tenant_legal_record: {
        Args: { p_tenant_id: string };
        Returns: string;
      };
      claim_account_deletion_requests: {
        Args: { p_limit?: number };
        Returns: Database["public"]["Tables"]["account_deletion_requests"]["Row"][];
      };
      claim_asaas_webhook_event: {
        Args: { p_event_id: string; p_event_type: string; p_payload: Json; p_stale_seconds?: number };
        Returns: string;
      };
      consume_api_rate_limit: {
        Args: { p_key_hash: string; p_limit: number; p_window_seconds: number };
        Returns: { allowed: boolean; remaining: number; reset_at: string; retry_after: number }[];
      };
      email_has_tenant: {
        Args: { p_email: string };
        Returns: boolean;
      };
      expire_stale_signup_intents: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      finalize_due_subscription_cancellations: {
        Args: { p_now?: string };
        Returns: number;
      };
      get_public_catalog: {
        Args: { p_slug: string };
        Returns: Json;
      };
      get_public_store_status: {
        Args: { p_slug: string };
        Returns: string | null;
      };
      reorder_categories: {
        Args: { p_ids: string[]; p_tenant_id: string };
        Returns: number;
      };
      purge_expired_operational_records: {
        Args: { p_now?: string };
        Returns: Json;
      };
      request_account_deletion: {
        Args: { p_owner_user_id: string; p_scheduled_for: string; p_tenant_id: string };
        Returns: Database["public"]["Tables"]["account_deletion_requests"]["Row"];
      };
      schedule_retention_deletions: {
        Args: { p_now?: string };
        Returns: number;
      };
      withdraw_expedited_account_deletion: {
        Args: { p_owner_user_id: string; p_tenant_id: string };
        Returns: Database["public"]["Tables"]["account_deletion_requests"]["Row"];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
