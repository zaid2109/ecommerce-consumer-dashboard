export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public readonly query?: string, cause?: Error) {
    super(message);
    this.name = "DatabaseError";
  }
}

export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PipelineError) {
      throw error;
    }
    
    if (error instanceof Error) {
      throw new PipelineError(
        `${context} failed: ${error.message}`,
        context,
        error
      );
    }
    
    throw new PipelineError(
      `${context} failed: Unknown error`,
      context
    );
  }
};

export const safeExecute = async <T>(
  operation: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.warn(`Safe execution failed in ${context}:`, error);
    return fallback;
  }
};
