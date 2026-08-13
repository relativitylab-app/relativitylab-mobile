import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  QuestionRepository,
  QuestionState,
  firebaseQuestionRepository,
} from "@/infrastructure/firebase/questionRepository";

export interface QuestionContextValue {
  readonly state: QuestionState;
  readonly retry: () => Promise<void>;
}

export interface QuestionProviderProps {
  readonly children: ReactNode;
  readonly repository?: QuestionRepository;
}

const QuestionContext = createContext<QuestionContextValue | undefined>(
  undefined,
);

export const QuestionProvider = ({
  children,
  repository = firebaseQuestionRepository,
}: QuestionProviderProps) => {
  const [state, setState] = useState<QuestionState>({ kind: "loading" });

  useEffect(() => repository.subscribe(setState), [repository]);

  const retry = useCallback(() => repository.refresh(), [repository]);
  const value = useMemo(() => ({ state, retry }), [retry, state]);

  return (
    <QuestionContext.Provider value={value}>
      {children}
    </QuestionContext.Provider>
  );
};

export const useQuestions = (): QuestionContextValue => {
  const context = useContext(QuestionContext);

  if (context === undefined) {
    throw new Error("useQuestions must be used within a QuestionProvider");
  }

  return context;
};
