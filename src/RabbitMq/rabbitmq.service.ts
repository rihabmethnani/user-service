import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQProducer implements OnModuleInit {
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private readonly exchangeName = 'user_events';

  async onModuleInit() {
    await this.connect();
  }

  async connect() {
    try {
      this.connection = await amqp.connect('amqp://localhost');
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });
      console.log('✅ Connected to RabbitMQ and Exchange asserted');
    } catch (error) {
      console.error('❌ Erreur lors de la connexion à RabbitMQ:', error);
    }
  }

  async publishEvent(eventType: string, payload: any) {
    if (!this.channel) {
      await this.connect();
    }

    const event = {
      eventId: `${Date.now()}-${Math.random()}`,
      eventType,
      payload,
    };

    const routingKey = `user.${eventType.toLowerCase()}`;
    this.channel.publish(
      this.exchangeName,
      routingKey,
      Buffer.from(JSON.stringify(event)),
    );

    console.log(`🚀 Event envoyé: ${routingKey}`, event);
  }
}