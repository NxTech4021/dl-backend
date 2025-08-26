class ApiResponse<T> {
  public success: boolean;
  public status: number;
  public data: T | null;
  public message: string;

  constructor(success: boolean, status: number, data: T | null, message: string = '') {
    this.success = success;
    this.status = status;
    this.data = data;
    this.message = message;
  }
}

export { ApiResponse };