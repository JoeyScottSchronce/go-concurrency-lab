import { Challenge } from '../types';

export function makeTopicKey(topicId: string): string {
  return topicId;
}

export function fingerprintChallenge(challenge: Challenge): string {
  return btoa(challenge.description + challenge.context).slice(0, 32);
}
