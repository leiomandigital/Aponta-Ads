import { supabase } from '@/lib/supabaseClient';

export const authService = {
  async entrarComEmailSenha(email: string, senha: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(error.message);
    return data;
  },

  async sair() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },
};
