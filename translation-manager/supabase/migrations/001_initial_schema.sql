-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Translations table
CREATE TABLE IF NOT EXISTS public.translations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_text TEXT NOT NULL,
  context TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'reviewed', 'deployed')) DEFAULT 'pending',
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Translation results table (language-specific translations)
CREATE TABLE IF NOT EXISTS public.translation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  translation_id UUID NOT NULL REFERENCES public.translations(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  reviewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(translation_id, language_code)
);

-- Glossary table
CREATE TABLE IF NOT EXISTS public.glossary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  term TEXT NOT NULL,
  translation TEXT NOT NULL,
  language_code TEXT NOT NULL,
  context TEXT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_translations_user_id ON public.translations(user_id);
CREATE INDEX IF NOT EXISTS idx_translations_team_id ON public.translations(team_id);
CREATE INDEX IF NOT EXISTS idx_translations_status ON public.translations(status);
CREATE INDEX IF NOT EXISTS idx_translations_source_text ON public.translations USING gin(to_tsvector('simple', source_text));
CREATE INDEX IF NOT EXISTS idx_translation_results_translation_id ON public.translation_results(translation_id);
CREATE INDEX IF NOT EXISTS idx_glossary_term ON public.glossary(term);
CREATE INDEX IF NOT EXISTS idx_glossary_language_code ON public.glossary(language_code);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glossary ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for teams
CREATE POLICY "Team members can view their teams" ON public.teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
    )
  );

-- RLS Policies for team_members
CREATE POLICY "Team members can view team membership" ON public.team_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
    )
  );

-- RLS Policies for translations
CREATE POLICY "Users can view their own translations or team translations" ON public.translations
  FOR SELECT USING (
    user_id = auth.uid() OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = translations.team_id
      AND team_members.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can insert their own translations" ON public.translations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own translations or team translations" ON public.translations
  FOR UPDATE USING (
    user_id = auth.uid() OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = translations.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    ))
  );

CREATE POLICY "Users can delete their own translations" ON public.translations
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for translation_results
CREATE POLICY "Users can view translation results" ON public.translation_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.translations
      WHERE translations.id = translation_results.translation_id
      AND (
        translations.user_id = auth.uid() OR
        (translations.team_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.team_members
          WHERE team_members.team_id = translations.team_id
          AND team_members.user_id = auth.uid()
        ))
      )
    )
  );

CREATE POLICY "Users can insert translation results" ON public.translation_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.translations
      WHERE translations.id = translation_results.translation_id
      AND translations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update translation results" ON public.translation_results
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.translations
      WHERE translations.id = translation_results.translation_id
      AND (
        translations.user_id = auth.uid() OR
        (translations.team_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.team_members
          WHERE team_members.team_id = translations.team_id
          AND team_members.user_id = auth.uid()
        ))
      )
    )
  );

-- RLS Policies for glossary
CREATE POLICY "Users can view their own glossary or team glossary" ON public.glossary
  FOR SELECT USING (
    user_id = auth.uid() OR
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = glossary.team_id
      AND team_members.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can insert their own glossary terms" ON public.glossary
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own glossary terms" ON public.glossary
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own glossary terms" ON public.glossary
  FOR DELETE USING (user_id = auth.uid());

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_translations_updated_at
  BEFORE UPDATE ON public.translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_translation_results_updated_at
  BEFORE UPDATE ON public.translation_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_glossary_updated_at
  BEFORE UPDATE ON public.glossary
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
