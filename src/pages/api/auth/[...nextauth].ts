import NextAuth from 'next-auth';
import { If, query as q } from 'faunadb';
import Providers from 'next-auth/providers';
import { fauna } from '../../../services/fauna';
import { toast } from 'react-toastify';


type Profile = {
  id: number;
  name: string;
  login: string;
  email: string;
  avatar_url: string;
}

type Data = {
  ref: {
    id: string;
  },
  data: {
    id: number;
    provider: string;
    name: string;
    login: string;
    email: string;
    avatar_url: string;
    level: number;
    currentExperience: number;
    challengesCompleted: number;
  }
}

type User = {
  data: {
    data: {
      id: number;
      provider: string;
      name: string;
      login: string;
      email: string;
      avatar_url: string;
      level: number;
      currentExperience: number;
      challengesCompleted: number;
    }
  }
}

export default NextAuth({

  providers: [
    Providers.GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      scope: 'read:user'
    }),
    Providers.Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?prompt=consent&access_type=offline&response_type=code',
    })
  ],
  callbacks: {
    async signIn(user, account, profile: Profile) {
      const { id, avatar_url, name, email, login } = profile;
      const { provider } = account

      try {

        const { data } = await fauna.query<Data>(
          q.If(q.And(
            q.Not(q.Exists(q.Match(q.Index('user_by_id'), q.Casefold(id)))),
            q.Not(q.Exists(q.Match(q.Index('user_by_email'), q.Casefold(email)))),
          ),
            q.Map(
              [
                [id,
                  {
                    "id": id,
                    "name": name,
                    "provider": provider,
                    "login": login,
                    "email": email,
                    "avatar_url": avatar_url,
                    "level": 1,
                    "currentExperience": 0,
                    "challengesCompleted": 0
                  }
                ]
              ],
              q.Lambda(
                ["dID", "data"],
                q.Create(q.Ref(q.Collection("users"), q.Var("dID")), { data: q.Var("data") })
              )
            ),
            q.Get(
              q.Match(
                q.Index('user_by_email'),
                q.Casefold(email)
              )
            )
          )
        )


        if (data.provider != provider) {
          await fauna.query(
            q.Update(
              q.Ref(q.Collection('users'), data.id),
              {
                data: {
                  provider: provider,
                }
              }
            )
          );
        }

        return true;
      } catch {
        return false;
      }
    }
  }
})