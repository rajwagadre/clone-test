export interface Message {
  id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
  senderId: string;
  receiverId: string;
  isPrivate: boolean; 
  sender: User;
  receiver: User;
}
