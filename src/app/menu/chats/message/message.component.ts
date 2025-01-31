  import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
  import { Observable } from 'rxjs';
  import { ChatService } from '../data-access/chat.service';
  import { Auth } from '@angular/fire/auth';
  import { ActivatedRoute, Router } from '@angular/router';
  import { CommonModule } from '@angular/common';
  import { IonicModule } from '@ionic/angular';
  import { FormsModule } from '@angular/forms';
  import { BackIconComponent } from '../../../UI/back-icon/back-icon.component';

  @Component({
    selector: 'app-message',
    templateUrl: './message.component.html',
    styleUrls: ['./message.component.scss'],
    standalone: true,
    imports: [CommonModule, IonicModule, FormsModule, BackIconComponent]
  })
  export class MessageComponent implements OnInit {
    @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
    private chatService = inject(ChatService);
    private auth = inject(Auth);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    mensaje: string = '';
    messages$: Observable<any>;
    currentUser = this.auth.currentUser;

    constructor() {
      const chatId = this.route.snapshot.paramMap.get('id') || '';
      this.messages$ = this.chatService.getMessages(chatId);
    }

    ngOnInit() {
      if (!this.currentUser) {
        this.router.navigate(['/login']);
        return;
      }
  
      this.messages$.subscribe(() => {
        setTimeout(() => {
          this.scrollToBottom();
        }, 100);
      });
  
      // Mark messages as read when entering the chat
      this.markMessagesAsRead();
    }
  
    private scrollToBottom(): void {
      try {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      } catch (err) {
        console.error('Error scrolling to bottom:', err);
      }
    }
    
    private initializeChat() {
      const chatId = this.route.snapshot.paramMap.get('id') || '';
      if (chatId) {
        this.messages$ = this.chatService.getMessages(chatId);
        this.markMessagesAsRead();
      }
    }

    private async markMessagesAsRead() {
      if (!this.currentUser) return;
      
      const chatId = this.getChatId();
      try {
        await this.chatService.markMessagesAsRead(chatId, this.currentUser.uid);
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    }

    private getChatId(): string {
      return this.route.snapshot.paramMap.get('id') || '';
    }

    async enviar_mensaje() {
      if (!this.mensaje.trim() || !this.currentUser) return;

      try {
        await this.chatService.sendMessage(
          this.getChatId(),
          this.currentUser.uid,
          this.currentUser.displayName || 'Usuario',
          this.mensaje
        );
        this.mensaje = '';
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }

    goBack() {
      this.router.navigate(['/menu/chats']);
    }
  }